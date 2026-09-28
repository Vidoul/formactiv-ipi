import { CodeRole, Modalite, StatutCompte } from '@prisma/client';
import request from 'supertest';
import { MailService } from '../src/modules/mail/mail.service';
import { ContexteTest, demarrerApplication, reinitialiserBase } from './utils/application';
import {
  MOT_DE_PASSE_TEST,
  autorisation,
  creerEntreprise,
  creerUtilisateur,
  type UtilisateurTest,
} from './utils/fabriques';

describe('Comptes, rôles et entreprises (UC-03, US-01/02, RG-CPT-01/02)', () => {
  let ctx: ContexteTest;
  let admin: UtilisateurTest;
  let resp: UtilisateurTest;

  beforeAll(async () => {
    ctx = await demarrerApplication();
  });
  beforeEach(async () => {
    await reinitialiserBase(ctx.prisma);
    MailService.boiteDEnvoi.length = 0;
    admin = await creerUtilisateur(ctx, CodeRole.ADMIN);
    resp = await creerUtilisateur(ctx, CodeRole.RESP_FORMATION);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const en = (u: UtilisateurTest) => ({ Authorization: autorisation(ctx, u) });

  describe('US-01 — création de compte', () => {
    it('crée le compte sans mot de passe et envoie un lien d’activation', async () => {
      const oxalys = await creerEntreprise(ctx);
      const res = await request(ctx.http)
        .post('/api/v1/utilisateurs')
        .set(en(admin))
        .send({
          nom: ' Martin ',
          prenom: 'Léa',
          email: 'Lea.Martin@Mail.fr',
          role: 'APPRENANT',
          entrepriseId: oxalys.id,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        nom: 'Martin',
        email: 'lea.martin@mail.fr',
        role: 'APPRENANT',
        active: false,
        entreprise: { raisonSociale: 'Groupe Oxalys' },
      });
      await new Promise((r) => setTimeout(r, 50));
      const email = MailService.boiteDEnvoi.find((m) => m.destinataire === 'lea.martin@mail.fr');
      expect(email?.texte).toMatch(/\/activation\?jeton=[\w-]{43}/);

      const jeton = /jeton=([\w-]{43})/.exec(email!.texte)![1];
      await request(ctx.http)
        .post('/api/v1/auth/activation')
        .send({
          jeton,
          motDePasse: MOT_DE_PASSE_TEST,
          consentementGestionCompte: true,
          consentementSatisfaction: false,
        })
        .expect(204);
      await request(ctx.http)
        .post('/api/v1/auth/login')
        .send({ email: 'lea.martin@mail.fr', motDePasse: MOT_DE_PASSE_TEST })
        .expect(200);
      expect(await ctx.prisma.journalAction.count({ where: { action: 'CREATION_COMPTE' } })).toBe(
        1,
      );
    });

    it('refuse un email déjà utilisé (insensible à la casse)', async () => {
      const res = await request(ctx.http)
        .post('/api/v1/utilisateurs')
        .set(en(admin))
        .send({ nom: 'X', prenom: 'Y', email: resp.email.toUpperCase(), role: 'FORMATEUR' })
        .expect(409);
      expect(res.body.code).toBe('EMAIL_DEJA_UTILISE');
    });

    it('exige une entreprise pour un client entreprise (REQ-FUNC-018)', async () => {
      const res = await request(ctx.http)
        .post('/api/v1/utilisateurs')
        .set(en(admin))
        .send({
          nom: 'Morel',
          prenom: 'Théo',
          email: 't.morel@oxalys.fr',
          role: 'CLIENT_ENTREPRISE',
        })
        .expect(400);
      expect(res.body.code).toBe('RATTACHEMENT_INVALIDE');
    });

    it('empêche le responsable formation de créer un administrateur ([À VALIDER])', async () => {
      await request(ctx.http)
        .post('/api/v1/utilisateurs')
        .set(en(resp))
        .send({ nom: 'A', prenom: 'B', email: 'nouvel.admin@test.fr', role: 'ADMIN' })
        .expect(403);
      await request(ctx.http)
        .post('/api/v1/utilisateurs')
        .set(en(resp))
        .send({ nom: 'A', prenom: 'B', email: 'nouveau.formateur@test.fr', role: 'FORMATEUR' })
        .expect(201);
    });

    it('refuse la création aux autres profils et journalise le refus', async () => {
      const formateur = await creerUtilisateur(ctx, CodeRole.FORMATEUR);
      await request(ctx.http)
        .post('/api/v1/utilisateurs')
        .set(en(formateur))
        .send({ nom: 'A', prenom: 'B', email: 'x@test.fr', role: 'APPRENANT' })
        .expect(403);
      const refus = await ctx.prisma.journalAction.findFirst({ where: { action: 'ACCES_REFUSE' } });
      expect(refus).toMatchObject({
        utilisateurId: formateur.id,
        details: 'POST /api/v1/utilisateurs',
      });
    });
  });

  describe('Portées de consultation (matrice RBAC)', () => {
    it('limite le formateur aux apprenants de ses sessions et le client à ses salariés', async () => {
      const oxalys = await creerEntreprise(ctx, 'Groupe Oxalys');
      const nexatech = await creerEntreprise(ctx, 'Nexatech');
      const formateur = await creerUtilisateur(ctx, CodeRole.FORMATEUR);
      const client = await creerUtilisateur(ctx, CodeRole.CLIENT_ENTREPRISE, {
        entrepriseId: oxalys.id,
      });
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT, { entrepriseId: oxalys.id });
      const paul = await creerUtilisateur(ctx, CodeRole.APPRENANT, { entrepriseId: nexatech.id });

      const formation = await ctx.prisma.formation.create({
        data: {
          intitule: 'Cyber',
          dureeHeures: 35,
          modalite: Modalite.HYBRIDE,
          prerequis: 'Aucun',
        },
      });
      const session = await ctx.prisma.session.create({
        data: {
          formationId: formation.id,
          dateDebut: new Date('2026-10-01'),
          dateFin: new Date('2026-10-05'),
          animations: { create: { formateurId: formateur.id } },
        },
      });
      await ctx.prisma.inscription.create({
        data: { apprenantId: paul.id, sessionId: session.id },
      });

      const vusFormateur = await request(ctx.http)
        .get('/api/v1/utilisateurs')
        .set(en(formateur))
        .expect(200);
      expect(vusFormateur.body.donnees.map((u: { id: string }) => u.id)).toEqual([paul.id]);

      const vusClient = await request(ctx.http)
        .get('/api/v1/utilisateurs')
        .set(en(client))
        .expect(200);
      expect(vusClient.body.donnees.map((u: { id: string }) => u.id)).toEqual([lea.id]);

      // Hors portée : 404 (l'existence du compte n'est pas révélée).
      await request(ctx.http).get(`/api/v1/utilisateurs/${paul.id}`).set(en(client)).expect(404);
      await request(ctx.http).get('/api/v1/utilisateurs').set(en(lea)).expect(403);
      await request(ctx.http).get(`/api/v1/utilisateurs/${lea.id}`).set(en(lea)).expect(200);
    });

    it('filtre et pagine la liste administrateur', async () => {
      for (let i = 0; i < 3; i++) await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const res = await request(ctx.http)
        .get('/api/v1/utilisateurs?role=APPRENANT&limit=2&page=2')
        .set(en(admin))
        .expect(200);
      expect(res.body).toMatchObject({ total: 3, page: 2, limit: 2 });
      expect(res.body.donnees).toHaveLength(1);
      expect(res.body.donnees[0]).not.toHaveProperty('motDePasseHash');
    });
  });

  describe('US-02 — rôles et modifications', () => {
    it('change le rôle, le journalise et ferme les sessions du compte', async () => {
      const cible = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const ancienJeton = autorisation(ctx, cible);
      const res = await request(ctx.http)
        .patch(`/api/v1/utilisateurs/${cible.id}`)
        .set(en(admin))
        .send({ role: 'FORMATEUR' })
        .expect(200);
      expect(res.body.role).toBe('FORMATEUR');

      const trace = await ctx.prisma.journalAction.findFirst({
        where: { action: 'CHANGEMENT_ROLE' },
      });
      expect(trace).toMatchObject({ idObjet: cible.id, details: 'APPRENANT vers FORMATEUR' });
      const refus = await request(ctx.http)
        .get('/api/v1/auth/moi')
        .set('Authorization', ancienJeton)
        .expect(401);
      expect(refus.body.code).toBe('SESSION_INVALIDE');
    });

    it('permet la rectification de son nom (REQ-RGPD-004) mais pas de son rôle', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      await request(ctx.http)
        .patch(`/api/v1/utilisateurs/${lea.id}`)
        .set(en(lea))
        .send({ nom: 'Martin-Durand' })
        .expect(200);
      expect(
        await ctx.prisma.journalAction.count({ where: { action: 'RECTIFICATION_DONNEES' } }),
      ).toBe(1);
      await request(ctx.http)
        .patch(`/api/v1/utilisateurs/${lea.id}`)
        .set(en(lea))
        .send({ role: 'ADMIN' })
        .expect(403);
    });

    it("interdit à l'administrateur de se retirer ses propres droits", async () => {
      const res = await request(ctx.http)
        .patch(`/api/v1/utilisateurs/${admin.id}`)
        .set(en(admin))
        .send({ role: 'APPRENANT' })
        .expect(409);
      expect(res.body.code).toBe('AUTO_MODIFICATION_INTERDITE');
    });

    it('interdit au responsable de modifier un administrateur', async () => {
      await request(ctx.http)
        .patch(`/api/v1/utilisateurs/${admin.id}`)
        .set(en(resp))
        .send({ nom: 'Pirate' })
        .expect(403);
    });

    it('déverrouille un compte et réinitialise la MFA', async () => {
      const cible = await creerUtilisateur(ctx, CodeRole.FORMATEUR, { mfa: true });
      await ctx.prisma.utilisateur.update({
        where: { id: cible.id },
        data: {
          statutCompte: StatutCompte.VERROUILLE,
          tentativesEchouees: 5,
          verrouilleJusquA: new Date(Date.now() + 600_000),
        },
      });
      const res = await request(ctx.http)
        .patch(`/api/v1/utilisateurs/${cible.id}`)
        .set(en(admin))
        .send({ statut: 'ACTIF', mfaActive: false })
        .expect(200);
      expect(res.body).toMatchObject({ statut: 'ACTIF', mfaActive: false, verrouilleJusquA: null });
      expect(
        await ctx.prisma.journalAction.count({ where: { action: 'DEVERROUILLAGE_COMPTE' } }),
      ).toBe(1);
      const compte = await ctx.prisma.utilisateur.findUniqueOrThrow({ where: { id: cible.id } });
      expect(compte.mfaSecretChiffre).toBeNull();
    });
  });

  describe('RG-CPT-02 — suppression ou anonymisation', () => {
    it('supprime physiquement un compte sans historique', async () => {
      const cible = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const res = await request(ctx.http)
        .delete(`/api/v1/utilisateurs/${cible.id}`)
        .set(en(admin))
        .expect(200);
      expect(res.body).toEqual({ resultat: 'SUPPRIME' });
      expect(await ctx.prisma.utilisateur.findUnique({ where: { id: cible.id } })).toBeNull();
    });

    it('anonymise un compte ayant un historique de formation et conserve les statistiques', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const formation = await ctx.prisma.formation.create({
        data: {
          intitule: 'Web',
          dureeHeures: 70,
          modalite: Modalite.DISTANCIEL,
          prerequis: 'Aucun',
        },
      });
      const session = await ctx.prisma.session.create({
        data: {
          formationId: formation.id,
          dateDebut: new Date('2026-01-10'),
          dateFin: new Date('2026-01-12'),
        },
      });
      await ctx.prisma.inscription.create({ data: { apprenantId: lea.id, sessionId: session.id } });

      const res = await request(ctx.http)
        .delete(`/api/v1/utilisateurs/${lea.id}`)
        .set(en(admin))
        .expect(200);
      expect(res.body).toEqual({ resultat: 'ANONYMISE' });

      const compte = await ctx.prisma.utilisateur.findUniqueOrThrow({ where: { id: lea.id } });
      expect(compte).toMatchObject({
        nom: 'Anonyme',
        email: `anonyme-${lea.id}@anonymise.invalid`,
        motDePasseHash: null,
        statutCompte: 'ANONYMISE',
      });
      expect(await ctx.prisma.inscription.count({ where: { apprenantId: lea.id } })).toBe(1);
      await request(ctx.http)
        .post('/api/v1/auth/login')
        .send({ email: lea.email, motDePasse: lea.motDePasse })
        .expect(401);
      await request(ctx.http).delete(`/api/v1/utilisateurs/${lea.id}`).set(en(admin)).expect(404);
    });

    it('réserve la suppression à l’administrateur', async () => {
      const cible = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      await request(ctx.http).delete(`/api/v1/utilisateurs/${cible.id}`).set(en(resp)).expect(403);
    });
  });

  describe('Entreprises clientes (REQ-FUNC-018)', () => {
    it('valide le SIRET et refuse les doublons', async () => {
      const invalide = await request(ctx.http)
        .post('/api/v1/entreprises')
        .set(en(resp))
        .send({ raisonSociale: 'Oxalys', siret: '81234567800018', emailContact: 'rh@oxalys.fr' })
        .expect(400);
      expect(invalide.body.details[0]).toMatchObject({ champ: 'siret' });

      await request(ctx.http)
        .post('/api/v1/entreprises')
        .set(en(resp))
        .send({ raisonSociale: 'Oxalys', siret: '81234567800013', emailContact: 'rh@oxalys.fr' })
        .expect(201);
      const doublon = await request(ctx.http)
        .post('/api/v1/entreprises')
        .set(en(resp))
        .send({ raisonSociale: 'Autre', siret: '81234567800013', emailContact: 'a@b.fr' })
        .expect(409);
      expect(doublon.body.code).toBe('SIRET_DEJA_UTILISE');
    });

    it("limite le client à sa propre entreprise et bloque la suppression d'une entreprise utilisée", async () => {
      const oxalys = await creerEntreprise(ctx, 'Groupe Oxalys');
      await creerEntreprise(ctx, 'Nexatech');
      const client = await creerUtilisateur(ctx, CodeRole.CLIENT_ENTREPRISE, {
        entrepriseId: oxalys.id,
      });

      const liste = await request(ctx.http).get('/api/v1/entreprises').set(en(client)).expect(200);
      expect(liste.body.donnees).toHaveLength(1);
      expect(liste.body.donnees[0]).toMatchObject({
        raisonSociale: 'Groupe Oxalys',
        nombreComptes: 1,
      });

      const refus = await request(ctx.http)
        .delete(`/api/v1/entreprises/${oxalys.id}`)
        .set(en(admin))
        .expect(409);
      expect(refus.body.code).toBe('ENTREPRISE_UTILISEE');
    });
  });

  describe('Paramètres de la plateforme', () => {
    it('applique immédiatement un nouveau seuil de verrouillage (RG-AUTH-02 paramétrable)', async () => {
      await request(ctx.http)
        .patch('/api/v1/parametres/securite.connexion.tentatives_max')
        .set(en(admin))
        .send({ valeur: '3' })
        .expect(200);
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      for (let i = 0; i < 2; i++) {
        await request(ctx.http)
          .post('/api/v1/auth/login')
          .send({ email: lea.email, motDePasse: 'Faux!Faux!123' })
          .expect(401);
      }
      await request(ctx.http)
        .post('/api/v1/auth/login')
        .send({ email: lea.email, motDePasse: 'Faux!Faux!123' })
        .expect(423);

      const trace = await ctx.prisma.journalAction.findFirst({
        where: { action: 'MODIFICATION_PARAMETRE' },
      });
      expect(trace?.details).toBe('5 → 3');
    });

    it('refuse une valeur hors bornes et réserve la gestion à l’administrateur', async () => {
      const res = await request(ctx.http)
        .patch('/api/v1/parametres/rgpd.conservation.journal_mois')
        .set(en(admin))
        .send({ valeur: '2' })
        .expect(400);
      expect(res.body.code).toBe('PARAMETRE_INVALIDE');
      await request(ctx.http).get('/api/v1/parametres').set(en(resp)).expect(403);
      const liste = await request(ctx.http).get('/api/v1/parametres').set(en(admin)).expect(200);
      expect(
        liste.body.find((p: { cle: string }) => p.cle === 'rgpd.conservation.journal_mois'),
      ).toMatchObject({
        valeur: '12',
        min: 6,
        max: 60,
      });
    });
  });
});
