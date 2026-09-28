import {
  CodeRole,
  Modalite,
  StatutCompte,
  StatutDemandeRgpd,
  StatutFormation,
  StatutInscription,
  TypeDemandeRgpd,
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

describe('Tableaux de bord et reporting (UC-12, RG-DASH-01..04)', () => {
  let ctx: ContexteTest;
  let resp: UtilisateurTest;
  let admin: UtilisateurTest;
  let karim: UtilisateurTest;
  let sonia: UtilisateurTest;
  let lea: UtilisateurTest;
  let paul: UtilisateurTest;
  let client: UtilisateurTest;
  let cyberPaul: string;
  let rgpdPaul: string;

  const J = aujourdhui();
  const periode = { du: ajouterJours(J, -60), au: ajouterJours(J, 30) };
  const en = (u: UtilisateurTest) => ({ Authorization: autorisation(ctx, u) });
  const indicateurs = (u: UtilisateurTest, q: Record<string, string> = {}) =>
    request(ctx.http)
      .get('/api/v1/reporting/indicateurs')
      .query({ ...periode, ...q })
      .set(en(u));

  beforeAll(async () => {
    ctx = await demarrerApplication();
  });
  beforeEach(async () => {
    await reinitialiserBase(ctx.prisma);
    const oxalys = await creerEntreprise(ctx);
    resp = await creerUtilisateur(ctx, CodeRole.RESP_FORMATION);
    admin = await creerUtilisateur(ctx, CodeRole.ADMIN, { prenom: 'Alex', nom: 'Dupré' });
    karim = await creerUtilisateur(ctx, CodeRole.FORMATEUR);
    sonia = await creerUtilisateur(ctx, CodeRole.FORMATEUR);
    lea = await creerUtilisateur(ctx, CodeRole.APPRENANT, {
      prenom: 'Léa',
      nom: 'Martin',
      entrepriseId: oxalys.id,
    });
    paul = await creerUtilisateur(ctx, CodeRole.APPRENANT, { prenom: 'Paul', nom: 'Girard' });
    const marc = await creerUtilisateur(ctx, CodeRole.APPRENANT, { entrepriseId: oxalys.id });
    client = await creerUtilisateur(ctx, CodeRole.CLIENT_ENTREPRISE, { entrepriseId: oxalys.id });

    const competence = (libelle: string) =>
      ctx.prisma.competence.create({ data: { libelle, typeReferentiel: TypeReferentiel.INTERNE } });
    const [c1, c2, c3] = await Promise.all([
      competence('Sécuriser un SI'),
      competence('Analyser les risques'),
      competence('Appliquer le RGPD'),
    ]);
    const formation = (intitule: string, competenceIds: string[]) =>
      ctx.prisma.formation.create({
        data: {
          intitule,
          dureeHeures: 14,
          modalite: Modalite.DISTANCIEL,
          prerequis: 'Aucun',
          statut: StatutFormation.PUBLIEE,
          competences: { create: competenceIds.map((competenceId) => ({ competenceId })) },
        },
      });
    const cyber = await formation('Cybersécurité fondamentaux', [c1.id, c2.id]);
    const rgpd = await formation('RGPD en pratique', [c3.id]);
    const session = (formationId: string, debut: number, fin: number, formateurId: string) =>
      ctx.prisma.session.create({
        data: {
          formationId,
          dateDebut: depuisIso(ajouterJours(J, debut)),
          dateFin: depuisIso(ajouterJours(J, fin)),
          lieu: 'Toulouse',
          animations: { create: { formateurId } },
        },
      });
    const sCyber = await session(cyber.id, -40, -36, karim.id);
    const sRgpd = await session(rgpd.id, 10, 11, karim.id);
    const sAncienne = await session(cyber.id, -100, -98, sonia.id);

    const inscrire = (apprenantId: string, sessionId: string, statut: StatutInscription) =>
      ctx.prisma.inscription.create({ data: { apprenantId, sessionId, statut } });
    const cyberLea = await inscrire(lea.id, sCyber.id, StatutInscription.TERMINEE);
    cyberPaul = (await inscrire(paul.id, sCyber.id, StatutInscription.TERMINEE)).id;
    await inscrire(lea.id, sRgpd.id, StatutInscription.VALIDEE);
    rgpdPaul = (await inscrire(paul.id, sRgpd.id, StatutInscription.EN_ATTENTE)).id;
    await inscrire(marc.id, sAncienne.id, StatutInscription.ANNULEE);

    const noter = (inscriptionId: string, competenceId: string, note: number) =>
      ctx.prisma.evaluation.create({
        data: { inscriptionId, competenceId, note, acquise: note >= 10, formateurId: karim.id },
      });
    await noter(cyberLea.id, c1.id, 15);
    await noter(cyberLea.id, c2.id, 12);
    await noter(cyberPaul, c1.id, 11);
    await noter(cyberPaul, c2.id, 7);
    await ctx.prisma.reponseSatisfaction.create({ data: { inscriptionId: cyberLea.id, score: 5 } });
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  // ------------------------------------------------------------------ Indicateurs

  it('RG-DASH-01 : calcule les indicateurs globaux du responsable formation', async () => {
    const r = await indicateurs(resp).expect(200);
    expect(r.body.periode).toEqual(periode);
    expect(r.body.indicateurs).toEqual({
      inscriptions: 4,
      apprenants: 2,
      validees: 3,
      terminees: 2,
      certificats: 1,
      tauxCompletion: 0.667,
      tauxReussite: 0.5,
      satisfaction: { moyenne: 5, reponses: 1 },
    });
    expect(r.body.comparaison).toMatchObject({
      inscriptionsPourcent: null,
      tauxReussitePoints: null,
    });
    expect(
      r.body.parFormation.map((f: { formation: { intitule: string } }) => f.formation.intitule),
    ).toEqual(['Cybersécurité fondamentaux', 'RGPD en pratique']);
    expect(r.body.parFormation[0]).toMatchObject({ inscriptions: 2, tauxReussite: 0.5, part: 0.5 });
    const moisCyber = ajouterJours(J, -40).slice(0, 7);
    expect(r.body.parMois).toContainEqual({
      mois: moisCyber,
      inscriptions: expect.any(Number),
      apprenants: 2,
    });
  });

  it('RG-DASH-02 : restreint les indicateurs à la portée de chaque rôle', async () => {
    const entreprise = await indicateurs(client).expect(200);
    expect(entreprise.body.indicateurs).toMatchObject({
      inscriptions: 2,
      apprenants: 1,
      certificats: 1,
      tauxReussite: 1,
      satisfaction: { moyenne: 5, reponses: 1 },
    });
    const apprenant = await indicateurs(paul).expect(200);
    expect(apprenant.body.indicateurs).toMatchObject({ inscriptions: 2, certificats: 0 });
    const autreFormateur = await indicateurs(sonia).expect(200);
    expect(autreFormateur.body.indicateurs.inscriptions).toBe(0);
  });

  it('RG-DASH-03 : filtres période, formation et entreprise (administration seulement)', async () => {
    const [cyber] = (await indicateurs(resp).expect(200)).body.parFormation;
    const filtre = await indicateurs(resp, { formationId: cyber.formation.id }).expect(200);
    expect(filtre.body.indicateurs.inscriptions).toBe(2);
    const refus = await indicateurs(client, { entrepriseId: client.entrepriseId! }).expect(403);
    expect(refus.body.code).toBe('FILTRE_NON_AUTORISE');
    const parEntreprise = await indicateurs(resp, { entrepriseId: client.entrepriseId! }).expect(
      200,
    );
    expect(parEntreprise.body.indicateurs.apprenants).toBe(1);
    const inversee = await indicateurs(resp, { du: J, au: ajouterJours(J, -1) }).expect(400);
    expect(inversee.body.code).toBe('PERIODE_INVALIDE');
    await indicateurs(resp, { du: '2026-02-30' }).expect(400);
  });

  // ------------------------------------------------------------------ Tableaux de bord par rôle

  it('écran 05 : tableau de bord d’administration (réservé à l’administrateur)', async () => {
    const hier = new Date(Date.now() - 86_400_000);
    await ctx.prisma.journalAction.createMany({
      data: [
        { action: 'CONNEXION_REUSSIE', utilisateurId: lea.id },
        { action: 'CONNEXION_REUSSIE', utilisateurId: paul.id, dateAction: hier },
        { action: 'CHANGEMENT_ROLE', utilisateurId: admin.id, typeObjet: 'utilisateur' },
      ],
    });
    await ctx.prisma.demandeRgpd.createMany({
      data: [
        { utilisateurId: lea.id, type: TypeDemandeRgpd.ACCES },
        {
          utilisateurId: paul.id,
          type: TypeDemandeRgpd.SUPPRESSION,
          statut: StatutDemandeRgpd.EN_COURS,
        },
        { utilisateurId: paul.id, type: TypeDemandeRgpd.ACCES, statut: StatutDemandeRgpd.TRAITEE },
      ],
    });
    await creerUtilisateur(ctx, CodeRole.APPRENANT, { statut: StatutCompte.VERROUILLE });
    await ctx.prisma.utilisateur.updateMany({
      where: { statutCompte: StatutCompte.VERROUILLE },
      data: { verrouilleJusquA: new Date(Date.now() + 600_000) },
    });

    const r = await request(ctx.http)
      .get('/api/v1/reporting/administration')
      .set(en(admin))
      .expect(200);
    expect(r.body.comptesActifs).toBe(
      await ctx.prisma.utilisateur.count({ where: { statutCompte: 'ACTIF' } }),
    );
    expect(r.body.connexions.total).toBe(2);
    expect(r.body.connexions.parJour).toHaveLength(7);
    expect(r.body.connexions.parJour[6]).toEqual({ jour: J, connexions: 1 });
    expect(r.body.demandesRgpd).toEqual({ enAttente: 2, suppressions: 1 });
    expect(r.body.comptesVerrouilles).toBe(1);
    expect(r.body.dernieresActions[0]).toMatchObject({
      action: 'CHANGEMENT_ROLE',
      auteur: { prenom: 'Alex', nom: 'Dupré' },
    });
    expect(
      r.body.dernieresActions.some((a: { action: string }) => a.action === 'CONNEXION_REUSSIE'),
    ).toBe(false);
    await request(ctx.http).get('/api/v1/reporting/administration').set(en(resp)).expect(403);
  });

  it('écran 17 : progression des groupes du formateur', async () => {
    const r = await request(ctx.http).get('/api/v1/reporting/formateur').set(en(karim)).expect(200);
    expect(r.body).toMatchObject({
      sessionsAVenir: 1,
      apprenantsSuivis: 2,
      acquisitionMoyenne: 0.75,
    });
    expect(r.body.parSession).toEqual([
      expect.objectContaining({ intitule: 'RGPD en pratique', apprenants: 1, partValidee: 0 }),
      expect.objectContaining({
        intitule: 'Cybersécurité fondamentaux',
        apprenants: 2,
        partValidee: 0.75,
      }),
    ]);
    await request(ctx.http).get('/api/v1/reporting/formateur').set(en(lea)).expect(403);
  });

  it('écran 18 : progression et prochaines échéances de l’apprenant', async () => {
    const r = await request(ctx.http).get('/api/v1/reporting/apprenant').set(en(lea)).expect(200);
    expect(r.body).toMatchObject({
      formationsSuivies: 2,
      competences: { acquises: 2, total: 3 },
      documents: { total: 0, certificats: 0, attestations: 0 },
      satisfactionAttendue: [],
    });
    expect(r.body.progression).toEqual([
      expect.objectContaining({ formation: 'RGPD en pratique', etat: 'A_VENIR' }),
      expect.objectContaining({
        formation: 'Cybersécurité fondamentaux',
        etat: 'TERMINEE',
        competencesAcquises: 2,
      }),
    ]);
    expect(r.body.prochainesSessions).toEqual([
      expect.objectContaining({
        formation: 'RGPD en pratique',
        modalite: 'DISTANCIEL',
        lieu: 'Toulouse',
      }),
    ]);
    const autre = await request(ctx.http)
      .get('/api/v1/reporting/apprenant')
      .set(en(paul))
      .expect(200);
    expect(autre.body.satisfactionAttendue).toEqual([
      { inscriptionId: cyberPaul, formation: 'Cybersécurité fondamentaux' },
    ]);
    expect(autre.body.consentementSatisfaction).toBe(false);
  });

  it('écran 21b : salariés du client entreprise avec avancement synthétique', async () => {
    const r = await request(ctx.http).get('/api/v1/reporting/salaries').set(en(client)).expect(200);
    expect(r.body).toMatchObject({ total: 2, salaries: 1 });
    expect(
      r.body.donnees.every((l: { apprenant: { prenom: string } }) => l.apprenant.prenom === 'Léa'),
    ).toBe(true);
    expect(r.body.donnees[0]).not.toHaveProperty('evaluations');
    const aVenir = await request(ctx.http)
      .get('/api/v1/reporting/salaries')
      .query({ etat: 'A_VENIR' })
      .set(en(client))
      .expect(200);
    expect(aVenir.body.donnees).toEqual([
      expect.objectContaining({ etat: 'A_VENIR', statut: 'VALIDEE', competencesVisees: 1 }),
    ]);
    await request(ctx.http).get('/api/v1/reporting/salaries').set(en(lea)).expect(403);
  });

  // ------------------------------------------------------------------ Satisfaction (RG-DASH-04)

  describe('questionnaire de satisfaction', () => {
    const repondre = (u: UtilisateurTest, inscriptionId: string, corps: object) =>
      request(ctx.http)
        .post(`/api/v1/inscriptions/${inscriptionId}/satisfaction`)
        .set(en(u))
        .send(corps);

    it('exige un consentement explicite et l’enregistre comme preuve', async () => {
      const sansAccord = await repondre(paul, cyberPaul, { score: 4, consentement: false }).expect(
        400,
      );
      expect(sansAccord.body.details[0]).toMatchObject({ champ: 'consentement' });

      const r = await repondre(paul, cyberPaul, {
        score: 4,
        commentaire: '  Très concret.  ',
        consentement: true,
      }).expect(201);
      expect(r.body).toMatchObject({ score: 4 });
      const reponse = await ctx.prisma.reponseSatisfaction.findUniqueOrThrow({
        where: { inscriptionId: cyberPaul },
      });
      expect(reponse.commentaire).toBe('Très concret.');
      const consentement = await ctx.prisma.consentement.findFirst({
        where: { utilisateurId: paul.id, finalite: 'QUESTIONNAIRES_SATISFACTION' },
      });
      expect(consentement).toMatchObject({ versionMentions: 'v2.1', dateRetrait: null });
      const actions = await ctx.prisma.journalAction.findMany({
        where: { utilisateurId: paul.id },
        select: { action: true },
      });
      expect(actions.map((a) => a.action).sort()).toEqual([
        'CONSENTEMENT_DONNE',
        'REPONSE_SATISFACTION',
      ]);

      const indic = await indicateurs(resp).expect(200);
      expect(indic.body.indicateurs.satisfaction).toEqual({ moyenne: 4.5, reponses: 2 });
    });

    it('refuse une seconde réponse, une formation non terminée et les inscriptions d’autrui', async () => {
      await repondre(paul, cyberPaul, { score: 3, consentement: true }).expect(201);
      const doublon = await repondre(paul, cyberPaul, { score: 5, consentement: true }).expect(409);
      expect(doublon.body.code).toBe('SATISFACTION_DEJA_DONNEE');
      const prematuree = await repondre(paul, rgpdPaul, { score: 5, consentement: true }).expect(
        409,
      );
      expect(prematuree.body.code).toBe('SATISFACTION_PREMATUREE');
      await repondre(lea, cyberPaul, { score: 5, consentement: true }).expect(404);
      await repondre(paul, cyberPaul, { score: 6, consentement: true }).expect(400);
      await repondre(resp, cyberPaul, { score: 5, consentement: true }).expect(403);
    });
  });
});
