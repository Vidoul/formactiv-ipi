import { CodeRole, Modalite, StatutFormation, TypeReferentiel } from '@prisma/client';
import request from 'supertest';
import { ajouterJours, aujourdhui } from '../src/common/utils/dates';
import { ContexteTest, demarrerApplication, reinitialiserBase } from './utils/application';
import {
  autorisation,
  creerEntreprise,
  creerUtilisateur,
  type UtilisateurTest,
} from './utils/fabriques';

describe('Sessions, affectations et inscriptions (UC-05, UC-06, UC-07)', () => {
  let ctx: ContexteTest;
  let resp: UtilisateurTest;
  let karim: UtilisateurTest;
  let sonia: UtilisateurTest;
  let lea: UtilisateurTest;
  let paul: UtilisateurTest;
  let sami: UtilisateurTest;
  let client: UtilisateurTest;
  let formationId: string;
  let brouillonId: string;

  const J = aujourdhui();
  const en = (u: UtilisateurTest) => ({ Authorization: autorisation(ctx, u) });

  beforeAll(async () => {
    ctx = await demarrerApplication();
  });
  beforeEach(async () => {
    await reinitialiserBase(ctx.prisma);
    const oxalys = await creerEntreprise(ctx, 'Groupe Oxalys');
    resp = await creerUtilisateur(ctx, CodeRole.RESP_FORMATION);
    karim = await creerUtilisateur(ctx, CodeRole.FORMATEUR, { nom: 'Selle', prenom: 'Karim' });
    sonia = await creerUtilisateur(ctx, CodeRole.FORMATEUR, { nom: 'Vidal', prenom: 'Sonia' });
    lea = await creerUtilisateur(ctx, CodeRole.APPRENANT, { entrepriseId: oxalys.id });
    paul = await creerUtilisateur(ctx, CodeRole.APPRENANT);
    sami = await creerUtilisateur(ctx, CodeRole.APPRENANT);
    client = await creerUtilisateur(ctx, CodeRole.CLIENT_ENTREPRISE, { entrepriseId: oxalys.id });
    const competence = await ctx.prisma.competence.create({
      data: { libelle: 'Analyser les risques', typeReferentiel: TypeReferentiel.INTERNE },
    });
    formationId = (
      await ctx.prisma.formation.create({
        data: {
          intitule: 'Cybersécurité fondamentaux',
          dureeHeures: 35,
          modalite: Modalite.HYBRIDE,
          prerequis: 'Bases en informatique',
          statut: StatutFormation.PUBLIEE,
          competences: { create: { competenceId: competence.id } },
        },
      })
    ).id;
    brouillonId = (
      await ctx.prisma.formation.create({
        data: {
          intitule: 'Brouillon',
          dureeHeures: 7,
          modalite: Modalite.PRESENTIEL,
          prerequis: 'Aucun',
        },
      })
    ).id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const planifier = (corps: object) =>
    request(ctx.http).post('/api/v1/sessions').set(en(resp)).send(corps);

  describe('UC-05 — planifier une session et affecter les intervenants', () => {
    it('planifie une session d’une formation publiée avec son formateur', async () => {
      const res = await planifier({
        formationId,
        dateDebut: ajouterJours(J, 30),
        dateFin: ajouterJours(J, 34),
        capaciteMax: 12,
        lieu: 'Toulouse',
        formateurIds: [karim.id],
      }).expect(201);
      expect(res.body).toMatchObject({
        statutTemporel: 'A_VENIR',
        capaciteMax: 12,
        nombreInscrits: 0,
        alerteSansFormateur: false,
        formateurs: [{ id: karim.id, prenom: 'Karim', conflits: [] }],
      });
      const actions = await ctx.prisma.journalAction.findMany({ where: { idObjet: res.body.id } });
      expect(actions.map((a) => a.action).sort()).toEqual([
        'AFFECTATION_FORMATEUR',
        'CREATION_SESSION',
      ]);
    });

    it('RG-SESS-01 : refuse des dates incohérentes ; exige une formation publiée', async () => {
      const dates = await planifier({
        formationId,
        dateDebut: '2026-09-18',
        dateFin: '2026-09-14',
      }).expect(400);
      expect(dates.body).toMatchObject({
        code: 'DATES_INCOHERENTES',
        details: [{ champ: 'dateFin' }],
      });
      const brouillon = await planifier({
        formationId: brouillonId,
        dateDebut: ajouterJours(J, 5),
        dateFin: ajouterJours(J, 6),
      }).expect(409);
      expect(brouillon.body.code).toBe('FORMATION_NON_PUBLIEE');
    });

    it('signale les conflits d’agenda du formateur (« Conflit le … », maquette 12)', async () => {
      await planifier({
        formationId,
        dateDebut: ajouterJours(J, 11),
        dateFin: ajouterJours(J, 12),
        formateurIds: [sonia.id],
      }).expect(201);
      const nouvelle = await planifier({
        formationId,
        dateDebut: ajouterJours(J, 10),
        dateFin: ajouterJours(J, 14),
      }).expect(201);

      const affectee = await request(ctx.http)
        .post(`/api/v1/sessions/${nouvelle.body.id}/formateurs/${sonia.id}`)
        .set(en(resp))
        .expect(201);
      expect(affectee.body.formateurs[0].conflits).toEqual([
        expect.objectContaining({ premierJour: ajouterJours(J, 11) }),
      ]);

      const dispo = await request(ctx.http)
        .get(
          `/api/v1/formateurs/disponibilites?debut=${ajouterJours(J, 10)}&fin=${ajouterJours(J, 14)}&sessionExclue=${nouvelle.body.id}`,
        )
        .set(en(resp))
        .expect(200);
      const parId = Object.fromEntries(
        dispo.body.map((f: { id: string; conflits: unknown[] }) => [f.id, f.conflits.length]),
      );
      expect(parId).toEqual({ [karim.id]: 0, [sonia.id]: 1 });
    });

    it('RG-SESS-02 : alerte sans formateur et conserve un formateur pour une session commencée', async () => {
      const proche = await planifier({
        formationId,
        dateDebut: ajouterJours(J, 5),
        dateFin: ajouterJours(J, 6),
      });
      expect(proche.body.alerteSansFormateur).toBe(true);

      const enCours = await planifier({
        formationId,
        dateDebut: ajouterJours(J, -1),
        dateFin: ajouterJours(J, 2),
        formateurIds: [karim.id],
      });
      const refus = await request(ctx.http)
        .delete(`/api/v1/sessions/${enCours.body.id}/formateurs/${karim.id}`)
        .set(en(resp))
        .expect(409);
      expect(refus.body.code).toBe('FORMATEUR_REQUIS');
    });

    it('refuse l’affectation d’un compte qui n’est pas formateur', async () => {
      const s = await planifier({
        formationId,
        dateDebut: ajouterJours(J, 20),
        dateFin: ajouterJours(J, 21),
      });
      await request(ctx.http)
        .post(`/api/v1/sessions/${s.body.id}/formateurs/${lea.id}`)
        .set(en(resp))
        .expect(400);
    });
  });

  describe('UC-06 — gérer les inscriptions', () => {
    let sessionId: string;
    const inscrire = (apprenantId: string) =>
      request(ctx.http)
        .post(`/api/v1/sessions/${sessionId}/inscriptions`)
        .set(en(resp))
        .send({ apprenantId });

    beforeEach(async () => {
      sessionId = (
        await planifier({
          formationId,
          dateDebut: ajouterJours(J, 10),
          dateFin: ajouterJours(J, 14),
          capaciteMax: 2,
          formateurIds: [karim.id],
        })
      ).body.id;
    });

    it('inscrit en attente, avertit sur les prérequis puis refuse le doublon (RG-INSC-01/03)', async () => {
      const res = await inscrire(lea.id).expect(201);
      expect(res.body).toMatchObject({
        avertissements: ['PREREQUIS_A_VERIFIER'],
        inscription: { statut: 'EN_ATTENTE', prerequisRequis: true, prerequisVerifies: false },
      });
      const doublon = await inscrire(lea.id).expect(409);
      expect(doublon.body.code).toBe('INSCRIPTION_EXISTANTE');
    });

    it('RG-SESS-03 : refuse l’inscription au-delà de la capacité', async () => {
      await inscrire(lea.id).expect(201);
      await inscrire(paul.id).expect(201);
      const refus = await inscrire(sami.id).expect(409);
      expect(refus.body.code).toBe('CAPACITE_ATTEINTE');
    });

    it('RG-SESS-03 : ne dépasse pas la capacité sous des inscriptions simultanées', async () => {
      await ctx.prisma.session.update({ where: { id: sessionId }, data: { capaciteMax: 1 } });
      const reponses = await Promise.all([inscrire(lea.id), inscrire(paul.id), inscrire(sami.id)]);
      expect(reponses.filter((r) => r.status === 201)).toHaveLength(1);
      expect(reponses.filter((r) => r.status === 409)).toHaveLength(2);
      expect(await ctx.prisma.inscription.count({ where: { sessionId } })).toBe(1);
    });

    it('RG-INSC-02 : valide après vérification des prérequis, puis annule et réinscrit', async () => {
      const { body } = await inscrire(lea.id);
      const id = body.inscription.id as string;
      const patch = (corps: object) =>
        request(ctx.http).patch(`/api/v1/inscriptions/${id}`).set(en(resp)).send(corps);

      expect((await patch({ statut: 'VALIDEE' }).expect(409)).body.code).toBe(
        'PREREQUIS_A_VERIFIER',
      );
      await patch({ statut: 'VALIDEE', prerequisVerifies: true }).expect(200);
      expect((await patch({ statut: 'TERMINEE' }).expect(409)).body.code).toBe(
        'SESSION_NON_TERMINEE',
      );
      await patch({ statut: 'ANNULEE' }).expect(200);
      expect((await patch({ statut: 'VALIDEE' }).expect(409)).body.code).toBe(
        'TRANSITION_STATUT_INVALIDE',
      );

      const reinscription = await inscrire(lea.id).expect(201);
      expect(reinscription.body.inscription).toMatchObject({ id, statut: 'EN_ATTENTE' });
      const trace = await ctx.prisma.journalAction.findFirst({
        where: { action: 'CHANGEMENT_STATUT_INSCRIPTION', details: 'EN_ATTENTE vers VALIDEE' },
      });
      expect(trace).not.toBeNull();
    });

    it('termine l’inscription une fois la session achevée', async () => {
      const passee = await ctx.prisma.session.create({
        data: {
          formationId,
          dateDebut: new Date(`${ajouterJours(J, -10)}T00:00:00Z`),
          dateFin: new Date(`${ajouterJours(J, -8)}T00:00:00Z`),
        },
      });
      const insc = await ctx.prisma.inscription.create({
        data: {
          apprenantId: paul.id,
          sessionId: passee.id,
          statut: 'VALIDEE',
          prerequisVerifies: true,
        },
      });
      const res = await request(ctx.http)
        .patch(`/api/v1/inscriptions/${insc.id}`)
        .set(en(resp))
        .send({ statut: 'TERMINEE' })
        .expect(200);
      expect(res.body.statut).toBe('TERMINEE');
      await request(ctx.http)
        .post(`/api/v1/sessions/${passee.id}/inscriptions`)
        .set(en(resp))
        .send({ apprenantId: sami.id })
        .expect(409);
    });
  });

  describe('UC-07 — portées de consultation', () => {
    it('limite chaque profil à ses sessions et inscriptions (matrice RBAC)', async () => {
      const deKarim = (
        await planifier({
          formationId,
          dateDebut: ajouterJours(J, 10),
          dateFin: ajouterJours(J, 11),
          formateurIds: [karim.id],
        })
      ).body.id;
      const deSonia = (
        await planifier({
          formationId,
          dateDebut: ajouterJours(J, 20),
          dateFin: ajouterJours(J, 21),
          formateurIds: [sonia.id],
        })
      ).body.id;
      for (const [sessionId, apprenant] of [
        [deKarim, lea],
        [deSonia, paul],
      ] as const) {
        await request(ctx.http)
          .post(`/api/v1/sessions/${sessionId}/inscriptions`)
          .set(en(resp))
          .send({ apprenantId: apprenant.id });
      }

      const sessionsKarim = await request(ctx.http)
        .get('/api/v1/sessions')
        .set(en(karim))
        .expect(200);
      expect(sessionsKarim.body.donnees.map((s: { id: string }) => s.id)).toEqual([deKarim]);
      await request(ctx.http).get(`/api/v1/sessions/${deSonia}`).set(en(karim)).expect(404);

      const inscritsKarim = await request(ctx.http)
        .get('/api/v1/inscriptions')
        .set(en(karim))
        .expect(200);
      expect(inscritsKarim.body.donnees).toHaveLength(1);
      expect(inscritsKarim.body.donnees[0].apprenant).not.toHaveProperty('email');

      const vueResp = await request(ctx.http).get('/api/v1/inscriptions').set(en(resp)).expect(200);
      expect(vueResp.body.donnees[0].apprenant).toHaveProperty('email');

      const sessionsLea = await request(ctx.http).get('/api/v1/sessions').set(en(lea)).expect(200);
      expect(sessionsLea.body.donnees.map((s: { id: string }) => s.id)).toEqual([deKarim]);

      const vueClient = await request(ctx.http)
        .get('/api/v1/inscriptions')
        .set(en(client))
        .expect(200);
      expect(
        vueClient.body.donnees.map((i: { apprenant: { id: string } }) => i.apprenant.id),
      ).toEqual([lea.id]);

      await request(ctx.http)
        .post(`/api/v1/sessions/${deKarim}/inscriptions`)
        .set(en(lea))
        .send({ apprenantId: lea.id })
        .expect(403);
    });
  });
});
