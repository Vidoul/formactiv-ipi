import {
  CodeRole,
  Modalite,
  StatutCompte,
  StatutFormation,
  StatutInscription,
  TypeReferentiel,
} from '@prisma/client';
import { access, mkdir, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { ajouterJours, aujourdhui, depuisIso } from '../src/common/utils/dates';
import { ContexteTest, demarrerApplication, reinitialiserBase } from './utils/application';
import {
  autorisation,
  creerEntreprise,
  creerUtilisateur,
  type UtilisateurTest,
} from './utils/fabriques';

const ANS = (n: number) => new Date(Date.now() - n * 365 * 86_400_000);

describe('RGPD et journal d’audit (UC-13, UC-14, UC-15, RG-RGPD-01..04)', () => {
  let ctx: ContexteTest;
  let admin: UtilisateurTest;
  let admin2: UtilisateurTest;
  let resp: UtilisateurTest;
  let lea: UtilisateurTest;

  const J = aujourdhui();
  const en = (u: UtilisateurTest) => ({ Authorization: autorisation(ctx, u) });
  const demander = (u: UtilisateurTest, corps: object) =>
    request(ctx.http).post('/api/v1/rgpd/demandes').set(en(u)).send(corps);
  const traiter = (u: UtilisateurTest, id: string, corps: object) =>
    request(ctx.http).patch(`/api/v1/rgpd/demandes/${id}`).set(en(u)).send(corps);

  beforeAll(async () => {
    ctx = await demarrerApplication();
  });
  beforeEach(async () => {
    await reinitialiserBase(ctx.prisma);
    const oxalys = await creerEntreprise(ctx);
    admin = await creerUtilisateur(ctx, CodeRole.ADMIN, { prenom: 'Alex', nom: 'Dupré' });
    admin2 = await creerUtilisateur(ctx, CodeRole.ADMIN);
    resp = await creerUtilisateur(ctx, CodeRole.RESP_FORMATION);
    lea = await creerUtilisateur(ctx, CodeRole.APPRENANT, {
      prenom: 'Léa',
      nom: 'Martin',
      email: 'lea.martin@mail.fr',
      entrepriseId: oxalys.id,
    });
    const formateur = await creerUtilisateur(ctx, CodeRole.FORMATEUR);
    const competence = await ctx.prisma.competence.create({
      data: { libelle: 'Sécuriser un SI', typeReferentiel: TypeReferentiel.INTERNE },
    });
    const formation = await ctx.prisma.formation.create({
      data: {
        intitule: 'Cybersécurité fondamentaux',
        dureeHeures: 35,
        modalite: Modalite.PRESENTIEL,
        prerequis: 'Aucun',
        statut: StatutFormation.PUBLIEE,
        competences: { create: { competenceId: competence.id } },
      },
    });
    const session = await ctx.prisma.session.create({
      data: {
        formationId: formation.id,
        dateDebut: depuisIso(ajouterJours(J, -20)),
        dateFin: depuisIso(ajouterJours(J, -16)),
      },
    });
    const inscription = await ctx.prisma.inscription.create({
      data: { apprenantId: lea.id, sessionId: session.id, statut: StatutInscription.TERMINEE },
    });
    await ctx.prisma.evaluation.create({
      data: {
        inscriptionId: inscription.id,
        competenceId: competence.id,
        note: 14,
        acquise: true,
        formateurId: formateur.id,
      },
    });
    await ctx.prisma.reponseSatisfaction.create({
      data: { inscriptionId: inscription.id, score: 5, commentaire: 'Très bien' },
    });
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  // ------------------------------------------------------------------ UC-13 : droits

  it('US-28 : restitue toutes les données de l’utilisateur, sans secret', async () => {
    const r = await request(ctx.http).get('/api/v1/rgpd/mes-donnees').set(en(lea)).expect(200);
    expect(r.body.compte).toMatchObject({
      nom: 'Martin',
      prenom: 'Léa',
      email: 'lea.martin@mail.fr',
      role: 'APPRENANT',
      entreprise: { raisonSociale: 'Groupe Oxalys' },
    });
    expect(r.body.consentements).toEqual([
      expect.objectContaining({ finalite: 'GESTION_COMPTE', versionMentions: 'v2.1' }),
    ]);
    expect(r.body.inscriptions).toHaveLength(1);
    expect(r.body.evaluations).toEqual([
      expect.objectContaining({ competence: 'Sécuriser un SI', note: 14, acquise: true }),
    ]);
    expect(r.body.satisfaction[0]).toMatchObject({ score: 5, commentaire: 'Très bien' });
    const texte = JSON.stringify(r.body);
    for (const secret of ['motDePasseHash', 'mfaSecretChiffre', 'argon2']) {
      expect(texte).not.toContain(secret);
    }
  });

  it('portabilité : export JSON téléchargeable et journalisé', async () => {
    const r = await request(ctx.http)
      .get('/api/v1/rgpd/mes-donnees/export')
      .set(en(lea))
      .buffer(true)
      .parse((res, rappel) => {
        let texte = '';
        res.setEncoding('utf8');
        res.on('data', (m: string) => (texte += m));
        res.on('end', () => rappel(null, texte));
      })
      .expect(200);
    expect(r.headers['content-disposition']).toBe(
      `attachment; filename="formactiv-mes-donnees-${J}.json"`,
    );
    const document = JSON.parse(r.body as string) as { editeur: string; compte: { email: string } };
    expect(document).toMatchObject({
      editeur: 'FORMACTIV',
      compte: { email: 'lea.martin@mail.fr' },
    });
    expect(
      await ctx.prisma.journalAction.count({
        where: { action: 'EXPORT_DONNEES_PERSONNELLES', utilisateurId: lea.id },
      }),
    ).toBe(1);
  });

  it('US-29 : rectification en libre-service du nom et du prénom (valeurs non journalisées)', async () => {
    const r = await request(ctx.http)
      .patch('/api/v1/rgpd/mes-donnees')
      .set(en(lea))
      .send({ nom: '  Martin-Roux ' })
      .expect(200);
    expect(r.body.compte.nom).toBe('Martin-Roux');
    const trace = await ctx.prisma.journalAction.findFirstOrThrow({
      where: { action: 'RECTIFICATION_DONNEES' },
    });
    expect(trace.details).toBe('champs : nom');
    // L'email ne se modifie pas en libre-service (demande de rectification).
    await request(ctx.http)
      .patch('/api/v1/rgpd/mes-donnees')
      .set(en(lea))
      .send({ email: 'autre@mail.fr' })
      .expect(400);
  });

  it('RG-RGPD-01 : donne et retire un consentement facultatif, preuves conservées', async () => {
    const url = '/api/v1/rgpd/consentements/QUESTIONNAIRES_SATISFACTION';
    await request(ctx.http).post(url).set(en(lea)).expect(201);
    const retrait = await request(ctx.http).delete(url).set(en(lea)).expect(200);
    const satisfaction = retrait.body.consentements.filter(
      (c: { finalite: string }) => c.finalite === 'QUESTIONNAIRES_SATISFACTION',
    );
    expect(satisfaction).toHaveLength(1);
    expect(satisfaction[0].dateRetrait).not.toBeNull();
    await request(ctx.http).post(url).set(en(lea)).expect(201);
    expect(
      await ctx.prisma.consentement.count({
        where: { utilisateurId: lea.id, finalite: 'QUESTIONNAIRES_SATISFACTION' },
      }),
    ).toBe(2);
    const actions = await ctx.prisma.journalAction.findMany({
      where: { utilisateurId: lea.id },
      select: { action: true },
      orderBy: { dateAction: 'asc' },
    });
    expect(actions.map((a) => a.action)).toEqual([
      'CONSENTEMENT_DONNE',
      'CONSENTEMENT_RETIRE',
      'CONSENTEMENT_DONNE',
    ]);

    const obligatoire = await request(ctx.http)
      .delete('/api/v1/rgpd/consentements/GESTION_COMPTE')
      .set(en(lea))
      .expect(422);
    expect(obligatoire.body.code).toBe('FINALITE_NON_REVOCABLE');
    await request(ctx.http).post('/api/v1/rgpd/consentements/INCONNUE').set(en(lea)).expect(400);
  });

  // ------------------------------------------------------------------ UC-14 : demandes

  it('US-30 : dépose une demande numérotée, une seule ouverte par type', async () => {
    const r = await demander(lea, {
      type: 'SUPPRESSION',
      message: 'Je quitte l’entreprise.',
    }).expect(201);
    expect(r.body).toMatchObject({ numero: 'D-1', type: 'SUPPRESSION', statut: 'RECUE' });
    const doublon = await demander(lea, { type: 'SUPPRESSION' }).expect(409);
    expect(doublon.body).toMatchObject({ code: 'DEMANDE_EN_COURS' });
    expect(doublon.body.message).toContain('D-1');
    await demander(lea, { type: 'ACCES' }).expect(201);
    await demander(lea, { type: 'INCONNU' }).expect(400);
    expect(await ctx.prisma.journalAction.count({ where: { action: 'DEMANDE_RGPD' } })).toBe(2);
  });

  it('écran 07 : file de traitement réservée à l’administrateur', async () => {
    await demander(lea, { type: 'SUPPRESSION' }).expect(201);
    const acces = (await demander(lea, { type: 'ACCES' }).expect(201)).body.id as string;
    await traiter(admin, acces, { statut: 'TRAITEE', reponse: 'Export transmis.' }).expect(200);

    const toutes = await request(ctx.http).get('/api/v1/rgpd/demandes').set(en(admin)).expect(200);
    expect(toutes.body.total).toBe(2);
    const ouvertes = await request(ctx.http)
      .get('/api/v1/rgpd/demandes')
      .query({ statut: 'OUVERTES' })
      .set(en(admin))
      .expect(200);
    expect(ouvertes.body.donnees).toEqual([
      expect.objectContaining({
        type: 'SUPPRESSION',
        demandeur: expect.objectContaining({ email: 'lea.martin@mail.fr' }),
      }),
    ]);
    await request(ctx.http).get('/api/v1/rgpd/demandes').set(en(resp)).expect(403);
    await request(ctx.http).get('/api/v1/rgpd/demandes').set(en(lea)).expect(403);
  });

  it('RG-CPT-02 : une suppression traitée anonymise le compte et clôt la demande', async () => {
    const id = (await demander(lea, { type: 'SUPPRESSION' }).expect(201)).body.id as string;
    const encours = await traiter(admin, id, { statut: 'EN_COURS' }).expect(200);
    expect(encours.body).toMatchObject({ statut: 'EN_COURS', dateTraitement: null });

    const r = await traiter(admin, id, { statut: 'TRAITEE', reponse: 'Compte effacé.' }).expect(
      200,
    );
    expect(r.body).toMatchObject({
      statut: 'TRAITEE',
      traitant: { prenom: 'Alex', nom: 'Dupré' },
      demandeur: { statutCompte: 'ANONYMISE', nom: 'Anonyme' },
    });
    expect(r.body.dateTraitement).not.toBeNull();
    const compte = await ctx.prisma.utilisateur.findUniqueOrThrow({ where: { id: lea.id } });
    expect(compte).toMatchObject({ statutCompte: StatutCompte.ANONYMISE, motDePasseHash: null });
    expect(compte.email).toMatch(/@anonymise\.invalid$/);
    // L'historique statistique reste, sans commentaire libre.
    expect(await ctx.prisma.inscription.count({ where: { apprenantId: lea.id } })).toBe(1);
    const reponse = await ctx.prisma.reponseSatisfaction.findFirstOrThrow();
    expect(reponse).toMatchObject({ score: 5, commentaire: null });
    // La session de l'utilisateur effacé est invalidée.
    await request(ctx.http).get('/api/v1/rgpd/mes-donnees').set(en(lea)).expect(401);
    expect(
      await ctx.prisma.journalAction.count({ where: { action: 'TRAITEMENT_DEMANDE_RGPD' } }),
    ).toBe(2);

    const cloturee = await traiter(admin, id, { statut: 'REFUSEE', reponse: 'x' }).expect(409);
    expect(cloturee.body).toMatchObject({ code: 'TRAITEMENT_IMPOSSIBLE' });
  });

  it('exige un refus motivé et interdit à l’administrateur d’effacer son propre compte', async () => {
    const id = (await demander(lea, { type: 'RECTIFICATION' }).expect(201)).body.id as string;
    const sansMotif = await traiter(admin, id, { statut: 'REFUSEE' }).expect(409);
    expect(sansMotif.body.message).toBe('Un refus doit être motivé.');
    await traiter(admin, id, { statut: 'REFUSEE', reponse: 'Donnée exacte.' }).expect(200);

    const propre = (await demander(admin, { type: 'SUPPRESSION' }).expect(201)).body.id as string;
    const refus = await traiter(admin, propre, { statut: 'TRAITEE' }).expect(409);
    expect(refus.body.code).toBe('AUTO_SUPPRESSION_INTERDITE');
    await traiter(admin2, propre, { statut: 'TRAITEE' }).expect(200);
  });

  // ------------------------------------------------------------------ UC-15 : journal

  it('écran 08 : consultation filtrée du journal, réservée à l’administrateur', async () => {
    const il = (jours: number) => new Date(Date.now() - jours * 86_400_000);
    await ctx.prisma.journalAction.createMany({
      data: [
        {
          action: 'CHANGEMENT_ROLE',
          utilisateurId: admin.id,
          typeObjet: 'utilisateur',
          dateAction: il(1),
        },
        { action: 'EXPORT_CSV', utilisateurId: resp.id, typeObjet: 'export', dateAction: il(2) },
        {
          action: 'VERROUILLAGE_COMPTE',
          utilisateurId: null,
          details: '5 échecs',
          dateAction: il(3),
        },
        { action: 'EXPORT_CSV', utilisateurId: resp.id, dateAction: il(45) },
      ],
    });
    const journal = (q: Record<string, string | number>) =>
      request(ctx.http).get('/api/v1/journal').query(q).set(en(admin)).expect(200);

    expect((await journal({})).body.total).toBe(4);
    expect((await journal({ jours: 30 })).body.total).toBe(3);
    const exports = await journal({ action: 'export_csv', jours: 90 });
    expect(exports.body.total).toBe(2);
    const alex = await journal({ utilisateur: 'dupré' });
    expect(alex.body.donnees).toEqual([
      expect.objectContaining({
        action: 'CHANGEMENT_ROLE',
        utilisateur: expect.objectContaining({ prenom: 'Alex' }),
      }),
    ]);
    const systeme = await journal({ utilisateur: 'système' });
    expect(systeme.body.donnees).toEqual([
      expect.objectContaining({ action: 'VERROUILLAGE_COMPTE', utilisateur: null }),
    ]);
    const page = await journal({ limit: 2, page: 2 });
    expect(page.body).toMatchObject({ total: 4, page: 2, limit: 2 });
    expect(page.body.donnees).toHaveLength(2);

    await request(ctx.http).get('/api/v1/journal').set(en(resp)).expect(403);
    await request(ctx.http).get('/api/v1/journal').query({ jours: 12 }).set(en(admin)).expect(400);
  });

  // ------------------------------------------------------------------ RG-RGPD-04 : conservation

  it('RG-RGPD-04 : la purge applique les durées de conservation et se journalise', async () => {
    // Apprenant inactif depuis 4 ans, avec historique : anonymisé.
    const inactif = await creerUtilisateur(ctx, CodeRole.APPRENANT);
    await ctx.prisma.utilisateur.update({
      where: { id: inactif.id },
      data: { dateDerniereConnexion: ANS(4) },
    });
    await ctx.prisma.journalAction.create({
      data: { action: 'CONNEXION_REUSSIE', utilisateurId: inactif.id },
    });
    // Compte jamais activé créé il y a 4 ans, sans historique : supprimé.
    const fantome = await creerUtilisateur(ctx, CodeRole.APPRENANT, { motDePasse: null });
    await ctx.prisma.utilisateur.update({
      where: { id: fantome.id },
      data: { dateCreation: ANS(4) },
    });
    // Administrateur inactif : jamais purgé (continuité d'administration).
    await ctx.prisma.utilisateur.update({
      where: { id: admin2.id },
      data: { dateDerniereConnexion: ANS(5) },
    });
    // Réponse de satisfaction de plus de 24 mois et entrée de journal de plus de 12 mois.
    await ctx.prisma.reponseSatisfaction.updateMany({ data: { dateReponse: ANS(3) } });
    await ctx.prisma.journalAction.create({
      data: { action: 'EXPORT_CSV', utilisateurId: resp.id, dateAction: ANS(2) },
    });
    // Fichier orphelin ancien et fichier récent non référencé.
    const dossier = path.join(process.env.STORAGE_LOCAL_DIR!, 'documents', 'purge-test');
    await mkdir(dossier, { recursive: true });
    const ancien = path.join(dossier, 'orphelin-ancien.pdf');
    const recent = path.join(dossier, 'orphelin-recent.pdf');
    await writeFile(ancien, '%PDF-1.7');
    await writeFile(recent, '%PDF-1.7');
    await utimes(ancien, ANS(1), ANS(1));

    const r = await request(ctx.http)
      .post('/api/v1/rgpd/conservation/purge')
      .set(en(admin))
      .expect(201);
    expect(r.body).toMatchObject({
      comptesAnonymises: 2,
      entreesJournalPurgees: 1,
      reponsesSatisfactionAnonymisees: 1,
    });
    expect(r.body.fichiersOrphelinsSupprimes).toBeGreaterThanOrEqual(1);

    expect(
      await ctx.prisma.utilisateur.findUniqueOrThrow({ where: { id: inactif.id } }),
    ).toMatchObject({ statutCompte: StatutCompte.ANONYMISE });
    expect(await ctx.prisma.utilisateur.findUnique({ where: { id: fantome.id } })).toBeNull();
    expect(
      await ctx.prisma.utilisateur.findUniqueOrThrow({ where: { id: admin2.id } }),
    ).toMatchObject({ statutCompte: StatutCompte.ACTIF });
    expect(await ctx.prisma.reponseSatisfaction.findFirstOrThrow()).toMatchObject({
      score: 5,
      commentaire: null,
    });
    await expect(access(ancien)).rejects.toThrow();
    await expect(access(recent)).resolves.toBeUndefined();
    const trace = await ctx.prisma.journalAction.findFirstOrThrow({
      where: { action: 'PURGE_CONSERVATION' },
    });
    expect(trace).toMatchObject({ utilisateurId: admin.id });
    expect(trace.details).toContain('comptes 2');

    await request(ctx.http).post('/api/v1/rgpd/conservation/purge').set(en(resp)).expect(403);
  });
});
