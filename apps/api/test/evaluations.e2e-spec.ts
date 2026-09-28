import {
  CodeRole,
  Modalite,
  StatutFormation,
  StatutInscription,
  TypeReferentiel,
} from '@prisma/client';
import request from 'supertest';
import { ajouterJours, aujourdhui, depuisIso } from '../src/common/utils/dates';
import { ContexteTest, demarrerApplication, reinitialiserBase } from './utils/application';
import {
  autorisation,
  creerEntreprise,
  creerUtilisateur,
  type UtilisateurTest,
} from './utils/fabriques';

describe('Évaluations (UC-08, US-16/17/18, RG-EVAL-01/02)', () => {
  let ctx: ContexteTest;
  let karim: UtilisateurTest;
  let sonia: UtilisateurTest;
  let resp: UtilisateurTest;
  let lea: UtilisateurTest;
  let paul: UtilisateurTest;
  let client: UtilisateurTest;
  let sessionId: string;
  let inscriptionLea: string;
  let inscriptionPaul: string;
  let securiser: string;
  let risques: string;
  let horsFormation: string;

  const J = aujourdhui();
  const en = (u: UtilisateurTest) => ({ Authorization: autorisation(ctx, u) });

  beforeAll(async () => {
    ctx = await demarrerApplication();
  });
  beforeEach(async () => {
    await reinitialiserBase(ctx.prisma);
    const oxalys = await creerEntreprise(ctx);
    karim = await creerUtilisateur(ctx, CodeRole.FORMATEUR);
    sonia = await creerUtilisateur(ctx, CodeRole.FORMATEUR);
    resp = await creerUtilisateur(ctx, CodeRole.RESP_FORMATION);
    lea = await creerUtilisateur(ctx, CodeRole.APPRENANT, { entrepriseId: oxalys.id });
    paul = await creerUtilisateur(ctx, CodeRole.APPRENANT);
    client = await creerUtilisateur(ctx, CodeRole.CLIENT_ENTREPRISE, { entrepriseId: oxalys.id });

    const competence = (libelle: string) =>
      ctx.prisma.competence.create({ data: { libelle, typeReferentiel: TypeReferentiel.INTERNE } });
    securiser = (await competence('Sécuriser un SI')).id;
    risques = (await competence('Analyser les risques')).id;
    horsFormation = (await competence('JavaScript')).id;

    const formation = await ctx.prisma.formation.create({
      data: {
        intitule: 'Cybersécurité fondamentaux',
        dureeHeures: 35,
        modalite: Modalite.HYBRIDE,
        prerequis: 'Aucun',
        statut: StatutFormation.PUBLIEE,
        seuilAcquisition: 12,
        competences: { create: [{ competenceId: securiser }, { competenceId: risques }] },
      },
    });
    sessionId = (
      await ctx.prisma.session.create({
        data: {
          formationId: formation.id,
          dateDebut: depuisIso(ajouterJours(J, -3)),
          dateFin: depuisIso(ajouterJours(J, 1)),
          animations: { create: { formateurId: karim.id } },
        },
      })
    ).id;
    const inscrire = (apprenantId: string, statut: StatutInscription) =>
      ctx.prisma.inscription.create({ data: { apprenantId, sessionId, statut } });
    inscriptionLea = (await inscrire(lea.id, StatutInscription.VALIDEE)).id;
    inscriptionPaul = (await inscrire(paul.id, StatutInscription.VALIDEE)).id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const saisir = (u: UtilisateurTest, inscriptionId: string, competenceId: string, note: number) =>
    request(ctx.http)
      .post(`/api/v1/inscriptions/${inscriptionId}/evaluations`)
      .set(en(u))
      .send({ competenceId, note });

  it('RG-EVAL-02 : calcule l’acquisition selon le seuil de la formation (12/20)', async () => {
    const acquise = await saisir(karim, inscriptionLea, securiser, 12).expect(201);
    expect(acquise.body).toMatchObject({ note: 12, acquise: true });
    const nonAcquise = await saisir(karim, inscriptionLea, risques, 11.5).expect(201);
    expect(nonAcquise.body.acquise).toBe(false);
    expect(await ctx.prisma.journalAction.count({ where: { action: 'SAISIE_NOTE' } })).toBe(2);
  });

  it('RG-EVAL-01 : refuse et journalise la saisie par un formateur non affecté (E1)', async () => {
    const refus = await saisir(sonia, inscriptionLea, securiser, 15).expect(404);
    // Hors de sa portée, la session n'existe pas pour ce formateur.
    expect(refus.body.code).toBe('INSCRIPTION_INTROUVABLE');
    // Le responsable formation consulte mais ne saisit pas (matrice RBAC) : refus journalisé.
    await saisir(resp, inscriptionLea, securiser, 15).expect(403);
    const trace = await ctx.prisma.journalAction.findFirst({
      where: { action: 'ACCES_REFUSE', utilisateurId: resp.id },
    });
    expect(trace?.details).toBe(`POST /api/v1/inscriptions/${inscriptionLea}/evaluations`);
    expect(await ctx.prisma.evaluation.count()).toBe(0);
  });

  it('valide les bornes de note et les compétences de la formation', async () => {
    const hors = await saisir(karim, inscriptionLea, securiser, 21).expect(400);
    expect(hors.body.details[0]).toMatchObject({ champ: 'note' });
    const competence = await saisir(karim, inscriptionLea, horsFormation, 10).expect(400);
    expect(competence.body.code).toBe('COMPETENCE_HORS_FORMATION');
  });

  it('refuse une seconde saisie puis journalise la correction avec l’ancienne valeur (A1)', async () => {
    const premiere = await saisir(karim, inscriptionLea, securiser, 9).expect(201);
    const doublon = await saisir(karim, inscriptionLea, securiser, 14).expect(409);
    expect(doublon.body).toMatchObject({
      code: 'EVALUATION_EXISTANTE',
      details: { evaluationId: premiere.body.id },
    });

    const correction = await request(ctx.http)
      .patch(`/api/v1/evaluations/${premiere.body.id}`)
      .set(en(karim))
      .send({ note: 14 })
      .expect(200);
    expect(correction.body).toMatchObject({ note: 14, acquise: true });
    const trace = await ctx.prisma.journalAction.findFirst({
      where: { action: 'CORRECTION_NOTE' },
    });
    expect(trace?.details).toBe('ancienne valeur 9 → 14');
  });

  it('refuse l’évaluation avant le début de la session ou d’une inscription non validée', async () => {
    await ctx.prisma.session.update({
      where: { id: sessionId },
      data: { dateDebut: depuisIso(ajouterJours(J, 2)), dateFin: depuisIso(ajouterJours(J, 3)) },
    });
    const avant = await saisir(karim, inscriptionLea, securiser, 12).expect(409);
    expect(avant.body.code).toBe('SESSION_NON_COMMENCEE');

    await ctx.prisma.session.update({
      where: { id: sessionId },
      data: { dateDebut: depuisIso(ajouterJours(J, -1)) },
    });
    await ctx.prisma.inscription.update({
      where: { id: inscriptionPaul },
      data: { statut: StatutInscription.EN_ATTENTE },
    });
    const attente = await saisir(karim, inscriptionPaul, securiser, 12).expect(409);
    expect(attente.body.code).toBe('INSCRIPTION_NON_EVALUABLE');
  });

  it('enregistre la feuille de session en une fois et calcule les compétences acquises', async () => {
    const feuilleVide = await request(ctx.http)
      .get(`/api/v1/sessions/${sessionId}/feuille-evaluation`)
      .set(en(karim))
      .expect(200);
    expect(feuilleVide.body).toMatchObject({ modifiable: true, lignes: [{}, {}] });
    expect(feuilleVide.body.competences.map((c: { libelle: string }) => c.libelle)).toEqual([
      'Analyser les risques',
      'Sécuriser un SI',
    ]);

    const feuille = await request(ctx.http)
      .put(`/api/v1/sessions/${sessionId}/feuille-evaluation`)
      .set(en(karim))
      .send({
        notes: [
          { inscriptionId: inscriptionLea, competenceId: securiser, note: 15 },
          { inscriptionId: inscriptionLea, competenceId: risques, note: 13 },
          { inscriptionId: inscriptionPaul, competenceId: securiser, note: 8 },
        ],
      })
      .expect(200);
    const parApprenant = Object.fromEntries(
      feuille.body.lignes.map(
        (l: { apprenant: { id: string }; acquises: number; total: number }) => [
          l.apprenant.id,
          `${l.acquises}/${l.total}`,
        ],
      ),
    );
    expect(parApprenant).toEqual({ [lea.id]: '2/2', [paul.id]: '0/2' });

    // Réenvoi identique : aucune nouvelle entrée de journal.
    const avant = await ctx.prisma.journalAction.count();
    await request(ctx.http)
      .put(`/api/v1/sessions/${sessionId}/feuille-evaluation`)
      .set(en(karim))
      .send({ notes: [{ inscriptionId: inscriptionLea, competenceId: securiser, note: 15 }] })
      .expect(200);
    expect(await ctx.prisma.journalAction.count()).toBe(avant);

    // Le responsable consulte sans pouvoir modifier.
    const lecture = await request(ctx.http)
      .get(`/api/v1/sessions/${sessionId}/feuille-evaluation`)
      .set(en(resp))
      .expect(200);
    expect(lecture.body.modifiable).toBe(false);
  });

  it('US-18 / portée (e) : l’apprenant voit ses notes, le client une synthèse sans note', async () => {
    await saisir(karim, inscriptionLea, securiser, 15).expect(201);
    const vueLea = await request(ctx.http)
      .get(`/api/v1/inscriptions/${inscriptionLea}/evaluations`)
      .set(en(lea))
      .expect(200);
    expect(vueLea.body[0]).toMatchObject({ note: 15, acquise: true });

    const vueClient = await request(ctx.http)
      .get(`/api/v1/inscriptions/${inscriptionLea}/evaluations`)
      .set(en(client))
      .expect(200);
    expect(vueClient.body[0]).toMatchObject({ note: null, acquise: true, formateur: null });

    await request(ctx.http)
      .get(`/api/v1/inscriptions/${inscriptionPaul}/evaluations`)
      .set(en(lea))
      .expect(404);
  });
});
