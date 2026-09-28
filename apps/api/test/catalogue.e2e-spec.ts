import { CodeRole } from '@prisma/client';
import request from 'supertest';
import { ContexteTest, demarrerApplication, reinitialiserBase } from './utils/application';
import { autorisation, creerUtilisateur, type UtilisateurTest } from './utils/fabriques';

describe('Catalogue des formations et référentiels (UC-04, US-06..09)', () => {
  let ctx: ContexteTest;
  let resp: UtilisateurTest;
  let apprenant: UtilisateurTest;

  beforeAll(async () => {
    ctx = await demarrerApplication();
  });
  beforeEach(async () => {
    await reinitialiserBase(ctx.prisma);
    resp = await creerUtilisateur(ctx, CodeRole.RESP_FORMATION);
    apprenant = await creerUtilisateur(ctx, CodeRole.APPRENANT);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const en = (u: UtilisateurTest) => ({ Authorization: autorisation(ctx, u) });

  const creerCompetence = (corps: object) =>
    request(ctx.http).post('/api/v1/competences').set(en(resp)).send(corps);

  describe('RG-COMP-01 — référentiels', () => {
    it('exige un code RNCP valide pour une compétence RNCP', async () => {
      const sansCode = await creerCompetence({
        libelle: 'Sécuriser un SI',
        typeReferentiel: 'RNCP',
      }).expect(400);
      expect(sansCode.body.details[0].champ).toBe('codeRncp');
      await creerCompetence({
        libelle: 'Sécuriser un SI',
        typeReferentiel: 'RNCP',
        codeRncp: 'RNCP36125-C2',
      }).expect(201);
    });

    it('refuse un libellé en double dans le même référentiel mais l’accepte dans l’autre', async () => {
      await creerCompetence({
        libelle: 'Écrire des requêtes SQL',
        typeReferentiel: 'INTERNE',
      }).expect(201);
      const doublon = await creerCompetence({
        libelle: 'écrire des requêtes sql',
        typeReferentiel: 'INTERNE',
      }).expect(409);
      expect(doublon.body.code).toBe('COMPETENCE_EXISTANTE');
      await creerCompetence({
        libelle: 'Écrire des requêtes SQL',
        typeReferentiel: 'RNCP',
        codeRncp: 'RNCP12345',
      }).expect(201);
    });

    it('réserve la gestion des référentiels au responsable formation', async () => {
      const formateur = await creerUtilisateur(ctx, CodeRole.FORMATEUR);
      await request(ctx.http)
        .post('/api/v1/competences')
        .set(en(formateur))
        .send({ libelle: 'X', typeReferentiel: 'INTERNE' })
        .expect(403);
      await request(ctx.http).get('/api/v1/competences').set(en(formateur)).expect(200);
      await request(ctx.http).get('/api/v1/competences').set(en(apprenant)).expect(403);
    });
  });

  describe('UC-04 — créer, paramétrer et publier une formation', () => {
    it('crée en brouillon, puis publie une fois une compétence associée (RG-FORM-01..03)', async () => {
      const creee = await request(ctx.http)
        .post('/api/v1/formations')
        .set(en(resp))
        .send({ intitule: 'Cybersécurité fondamentaux', dureeHeures: 35, modalite: 'HYBRIDE' })
        .expect(201);
      expect(creee.body).toMatchObject({
        statut: 'BROUILLON',
        prerequis: 'Aucun',
        seuilAcquisition: 10,
        competences: [],
      });
      const id = creee.body.id as string;

      const refus = await request(ctx.http)
        .patch(`/api/v1/formations/${id}`)
        .set(en(resp))
        .send({ statut: 'PUBLIEE' })
        .expect(409);
      expect(refus.body.message).toMatch(/RG-FORM-02/);

      const competence = await creerCompetence({
        libelle: 'Analyser les risques',
        typeReferentiel: 'RNCP',
        codeRncp: 'RNCP36125-C3',
      });
      const avecCompetence = await request(ctx.http)
        .post(`/api/v1/formations/${id}/competences`)
        .set(en(resp))
        .send({ competenceId: competence.body.id })
        .expect(201);
      expect(avecCompetence.body.competences).toHaveLength(1);

      await request(ctx.http)
        .patch(`/api/v1/formations/${id}`)
        .set(en(resp))
        .send({ statut: 'PUBLIEE' })
        .expect(200);
      const trace = await ctx.prisma.journalAction.findFirst({
        where: { action: 'CHANGEMENT_STATUT_FORMATION' },
      });
      expect(trace?.details).toBe('BROUILLON vers PUBLIEE');

      // Une formation publiée conserve au moins une compétence.
      await request(ctx.http)
        .delete(`/api/v1/formations/${id}/competences/${competence.body.id}`)
        .set(en(resp))
        .expect(409);
    });

    it('valide les champs obligatoires par champ (E1)', async () => {
      const res = await request(ctx.http)
        .post('/api/v1/formations')
        .set(en(resp))
        .send({ intitule: '', dureeHeures: 0, modalite: 'SUR_LA_LUNE' })
        .expect(400);
      const champs = res.body.details.map((d: { champ: string }) => d.champ);
      expect(champs).toEqual(expect.arrayContaining(['intitule', 'dureeHeures', 'modalite']));
    });

    it('RG-FORM-03 : ne montre aux apprenants que les formations publiées', async () => {
      const comp = await creerCompetence({ libelle: 'HTML', typeReferentiel: 'INTERNE' });
      const publiee = await request(ctx.http)
        .post('/api/v1/formations')
        .set(en(resp))
        .send({
          intitule: 'Développement web',
          dureeHeures: 70,
          modalite: 'DISTANCIEL',
          competenceIds: [comp.body.id],
        });
      await request(ctx.http)
        .patch(`/api/v1/formations/${publiee.body.id}`)
        .set(en(resp))
        .send({ statut: 'PUBLIEE' });
      const brouillon = await request(ctx.http)
        .post('/api/v1/formations')
        .set(en(resp))
        .send({ intitule: 'Management IT', dureeHeures: 21, modalite: 'PRESENTIEL' });

      const vueApprenant = await request(ctx.http)
        .get('/api/v1/formations')
        .set(en(apprenant))
        .expect(200);
      expect(vueApprenant.body.donnees.map((f: { intitule: string }) => f.intitule)).toEqual([
        'Développement web',
      ]);
      await request(ctx.http)
        .get(`/api/v1/formations/${brouillon.body.id}`)
        .set(en(apprenant))
        .expect(404);

      const vueResp = await request(ctx.http).get('/api/v1/formations').set(en(resp)).expect(200);
      expect(vueResp.body.total).toBe(2);
    });

    it('verrouille le seuil d’acquisition dès que des notes existent (RG-EVAL-02)', async () => {
      const comp = await creerCompetence({ libelle: 'SQL', typeReferentiel: 'INTERNE' });
      const f = await request(ctx.http)
        .post('/api/v1/formations')
        .set(en(resp))
        .send({
          intitule: 'Bases de données',
          dureeHeures: 14,
          modalite: 'DISTANCIEL',
          competenceIds: [comp.body.id],
          seuilAcquisition: 12,
        });
      const session = await ctx.prisma.session.create({
        data: {
          formationId: f.body.id,
          dateDebut: new Date('2026-06-01'),
          dateFin: new Date('2026-06-02'),
        },
      });
      const insc = await ctx.prisma.inscription.create({
        data: { apprenantId: apprenant.id, sessionId: session.id },
      });
      await ctx.prisma.evaluation.create({
        data: {
          inscriptionId: insc.id,
          competenceId: comp.body.id,
          note: 14,
          acquise: true,
          formateurId: resp.id,
        },
      });
      const res = await request(ctx.http)
        .patch(`/api/v1/formations/${f.body.id}`)
        .set(en(resp))
        .send({ seuilAcquisition: 15 })
        .expect(409);
      expect(res.body.code).toBe('SEUIL_VERROUILLE');
      await request(ctx.http)
        .delete(`/api/v1/competences/${comp.body.id}`)
        .set(en(resp))
        .expect(409);
    });

    it('supprime un brouillon sans session mais impose l’archivage sinon', async () => {
      const f = await request(ctx.http)
        .post('/api/v1/formations')
        .set(en(resp))
        .send({ intitule: 'Temporaire', dureeHeures: 7, modalite: 'PRESENTIEL' });
      await ctx.prisma.session.create({
        data: {
          formationId: f.body.id,
          dateDebut: new Date('2026-06-01'),
          dateFin: new Date('2026-06-02'),
        },
      });
      const refus = await request(ctx.http)
        .delete(`/api/v1/formations/${f.body.id}`)
        .set(en(resp))
        .expect(409);
      expect(refus.body.code).toBe('FORMATION_NON_SUPPRIMABLE');

      const autre = await request(ctx.http)
        .post('/api/v1/formations')
        .set(en(resp))
        .send({ intitule: 'À supprimer', dureeHeures: 7, modalite: 'PRESENTIEL' });
      await request(ctx.http)
        .delete(`/api/v1/formations/${autre.body.id}`)
        .set(en(resp))
        .expect(204);
    });
  });
});
