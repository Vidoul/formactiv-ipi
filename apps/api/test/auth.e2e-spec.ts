import { CodeRole, StatutCompte, TypeJeton } from '@prisma/client';
import request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service';
import { MailService } from '../src/modules/mail/mail.service';
import { ContexteTest, demarrerApplication, reinitialiserBase } from './utils/application';
import {
  MOT_DE_PASSE_TEST,
  autorisation,
  codeMfa,
  cookieRefresh,
  creerUtilisateur,
} from './utils/fabriques';

const attendreEmail = async (destinataire: string) => {
  for (let i = 0; i < 50; i++) {
    const m = MailService.boiteDEnvoi.find((e) => e.destinataire === destinataire);
    if (m) return m;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(`Aucun email reçu pour ${destinataire}`);
};

describe('Authentification (UC-01, UC-02, US-03/04/05)', () => {
  let ctx: ContexteTest;

  beforeAll(async () => {
    ctx = await demarrerApplication();
  });
  beforeEach(async () => {
    await reinitialiserBase(ctx.prisma);
    MailService.boiteDEnvoi.length = 0;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const login = (email: string, motDePasse: string) =>
    request(ctx.http).post('/api/v1/auth/login').send({ email, motDePasse });

  describe('UC-01 — connexion', () => {
    it('ouvre une session : access token, cookie refresh httpOnly SameSite=Strict, journal', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const res = await login(lea.email.toUpperCase(), lea.motDePasse).expect(200);

      expect(res.body).toMatchObject({ mfaRequis: false, expireDans: 900 });
      expect(res.body.utilisateur).toMatchObject({ email: lea.email, role: 'APPRENANT' });
      expect(res.body.utilisateur).not.toHaveProperty('motDePasseHash');

      const cookie = ([] as string[]).concat(res.headers['set-cookie'])[0];
      expect(cookie).toMatch(/formactiv_refresh=[\w-]{43}/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
      expect(cookie).toMatch(/Path=\/api\/v1\/auth/);

      await request(ctx.http)
        .get('/api/v1/auth/moi')
        .set('Authorization', `Bearer ${res.body.accessToken}`)
        .expect(200);

      const entree = await ctx.prisma.journalAction.findFirst({
        where: { action: 'CONNEXION_REUSSIE', utilisateurId: lea.id },
      });
      expect(entree).not.toBeNull();
      const compte = await ctx.prisma.utilisateur.findUniqueOrThrow({ where: { id: lea.id } });
      expect(compte.dateDerniereConnexion).not.toBeNull();
    });

    it('renvoie le même message que l’email existe ou non (anti-énumération, A1)', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const mauvais = await login(lea.email, 'Mauvais!Motdepasse1').expect(401);
      const inconnu = await login('personne@test.fr', 'Mauvais!Motdepasse1').expect(401);
      expect(mauvais.body.code).toBe('IDENTIFIANTS_INVALIDES');
      expect(inconnu.body.message).toBe(mauvais.body.message);
    });

    it('RG-AUTH-02 : verrouille le compte 15 min au 5e échec, puis refuse même le bon mot de passe', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      for (let i = 1; i <= 4; i++) await login(lea.email, `Faux!Motdepasse${i}`).expect(401);
      const cinquieme = await login(lea.email, 'Faux!Motdepasse5').expect(423);
      expect(cinquieme.body).toMatchObject({
        code: 'COMPTE_VERROUILLE',
        details: { minutesRestantes: 15 },
      });

      const sixieme = await login(lea.email, lea.motDePasse).expect(423);
      expect(sixieme.body.code).toBe('COMPTE_VERROUILLE');

      const journal = await ctx.prisma.journalAction.findMany({
        where: { idObjet: lea.id, action: { in: ['CONNEXION_ECHOUEE', 'VERROUILLAGE_COMPTE'] } },
      });
      expect(journal.filter((j) => j.action === 'CONNEXION_ECHOUEE')).toHaveLength(5);
      expect(journal.filter((j) => j.action === 'VERROUILLAGE_COMPTE')).toHaveLength(1);
      // Le mot de passe n'est jamais journalisé (REQ-SEC-001).
      expect(JSON.stringify(journal)).not.toContain('Faux!Motdepasse');

      // Une fois la durée écoulée, le compte est déverrouillé automatiquement.
      await ctx.prisma.utilisateur.update({
        where: { id: lea.id },
        data: { verrouilleJusquA: new Date(Date.now() - 1000) },
      });
      await login(lea.email, lea.motDePasse).expect(200);
      const compte = await ctx.prisma.utilisateur.findUniqueOrThrow({ where: { id: lea.id } });
      expect(compte).toMatchObject({ statutCompte: StatutCompte.ACTIF, tentativesEchouees: 0 });
    });

    it('refuse un compte désactivé ou non activé (E1)', async () => {
      const inactif = await creerUtilisateur(ctx, CodeRole.APPRENANT, {
        statut: StatutCompte.DESACTIVE,
      });
      await login(inactif.email, inactif.motDePasse).expect(401);
      const nonActive = await creerUtilisateur(ctx, CodeRole.APPRENANT, { motDePasse: null });
      await login(nonActive.email, MOT_DE_PASSE_TEST).expect(401);
    });

    it('rejette les champs non prévus (affectation de masse)', async () => {
      const res = await request(ctx.http)
        .post('/api/v1/auth/login')
        .send({ email: 'a@b.fr', motDePasse: 'x', role: 'ADMIN' })
        .expect(400);
      expect(res.body.code).toBe('VALIDATION');
    });
  });

  describe('Double authentification TOTP (RG-AUTH-03)', () => {
    it('exige le second facteur, refuse un code faux puis le rejeu d’un code valide', async () => {
      const nadia = await creerUtilisateur(ctx, CodeRole.RESP_FORMATION);
      const etape1 = await login(nadia.email, nadia.motDePasse).expect(200);
      expect(etape1.body).toEqual({ mfaRequis: true, jetonMfa: expect.any(String) });
      expect(etape1.headers['set-cookie']).toBeUndefined();

      const code = codeMfa(nadia.secretMfa!);
      const faux = code === '000000' ? '111111' : '000000';
      const refus = await request(ctx.http)
        .post('/api/v1/auth/mfa')
        .send({ jetonMfa: etape1.body.jetonMfa, code: faux })
        .expect(401);
      expect(refus.body.code).toBe('CODE_MFA_INVALIDE');

      const ok = await request(ctx.http)
        .post('/api/v1/auth/mfa')
        .send({ jetonMfa: etape1.body.jetonMfa, code })
        .expect(200);
      expect(ok.body.utilisateur).toMatchObject({ role: 'RESP_FORMATION', mfaActive: true });
      expect(cookieRefresh(ok)).toBeDefined();

      const rejeu = await login(nadia.email, nadia.motDePasse);
      await request(ctx.http)
        .post('/api/v1/auth/mfa')
        .send({ jetonMfa: rejeu.body.jetonMfa, code })
        .expect(401);
    });

    it('refuse un jeton MFA forgé ou utilisé comme access token', async () => {
      const nadia = await creerUtilisateur(ctx, CodeRole.RESP_FORMATION);
      const etape1 = await login(nadia.email, nadia.motDePasse);
      await request(ctx.http)
        .get('/api/v1/auth/moi')
        .set('Authorization', `Bearer ${etape1.body.jetonMfa}`)
        .expect(401);
    });

    it('impose la configuration de la MFA aux rôles concernés puis l’active', async () => {
      const resp = await creerUtilisateur(ctx, CodeRole.RESP_FORMATION, { mfa: false });
      const auth = autorisation(ctx, resp);

      const moi = await request(ctx.http)
        .get('/api/v1/auth/moi')
        .set('Authorization', auth)
        .expect(200);
      expect(moi.body.mfaEnrolementRequis).toBe(true);

      // Toute autre fonctionnalité est bloquée tant que la MFA n'est pas configurée.
      const bloque = await request(ctx.http)
        .post('/api/v1/auth/mfa/desactivation')
        .set('Authorization', auth)
        .send({ motDePasse: resp.motDePasse, code: '123456' })
        .expect(403);
      expect(bloque.body.code).toBe('MFA_ENROLEMENT_REQUIS');

      const enrolement = await request(ctx.http)
        .post('/api/v1/auth/mfa/enrolement')
        .set('Authorization', auth)
        .expect(200);
      expect(enrolement.body.qrCode).toMatch(/^data:image\/png;base64,/);

      const confirme = await request(ctx.http)
        .post('/api/v1/auth/mfa/enrolement/confirmation')
        .set('Authorization', auth)
        .send({ code: codeMfa(enrolement.body.secret) })
        .expect(200);
      expect(confirme.body).toMatchObject({ mfaActive: true, mfaEnrolementRequis: false });
      expect(await ctx.prisma.journalAction.count({ where: { action: 'MFA_ACTIVATION' } })).toBe(1);
    });

    it("interdit de désactiver la MFA lorsqu'elle est obligatoire pour le rôle", async () => {
      const admin = await creerUtilisateur(ctx, CodeRole.ADMIN);
      const res = await request(ctx.http)
        .post('/api/v1/auth/mfa/desactivation')
        .set('Authorization', autorisation(ctx, admin))
        .send({ motDePasse: admin.motDePasse, code: codeMfa(admin.secretMfa!) })
        .expect(403);
      expect(res.body.code).toBe('MFA_OBLIGATOIRE');
    });
  });

  describe('Refresh token (chapitre 10)', () => {
    it('fait tourner le refresh token et détecte la réutilisation d’un jeton révoqué', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const connexion = await login(lea.email, lea.motDePasse).expect(200);
      const cookie1 = cookieRefresh(connexion)!;

      const rotation = await request(ctx.http)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie1)
        .expect(200);
      const cookie2 = cookieRefresh(rotation)!;
      expect(cookie2).not.toBe(cookie1);
      expect(rotation.body.accessToken).toEqual(expect.any(String));

      // Simule une réutilisation de l'ancien jeton au-delà de la fenêtre de concurrence.
      await ctx.prisma.jetonRefresh.updateMany({
        where: { utilisateurId: lea.id, dateRevocation: { not: null } },
        data: { dateRevocation: new Date(Date.now() - 60_000) },
      });
      await request(ctx.http).post('/api/v1/auth/refresh').set('Cookie', cookie1).expect(401);
      // Toute la famille est révoquée : le jeton légitime ne fonctionne plus non plus.
      await request(ctx.http).post('/api/v1/auth/refresh').set('Cookie', cookie2).expect(401);
      expect(
        await ctx.prisma.journalAction.count({ where: { action: 'REUTILISATION_JETON' } }),
      ).toBe(1);
    });

    it('révoque la session à la déconnexion', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const cookie = cookieRefresh(await login(lea.email, lea.motDePasse))!;
      await request(ctx.http).post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);
      await request(ctx.http).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
      const sansCookie = await request(ctx.http).post('/api/v1/auth/refresh').expect(401);
      expect(sansCookie.body.code).toBe('REFRESH_ABSENT');
    });

    it('invalide immédiatement les jetons d’un compte désactivé', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const auth = autorisation(ctx, lea);
      await request(ctx.http).get('/api/v1/auth/moi').set('Authorization', auth).expect(200);
      await ctx.prisma.utilisateur.update({
        where: { id: lea.id },
        data: { statutCompte: StatutCompte.DESACTIVE },
      });
      const res = await request(ctx.http)
        .get('/api/v1/auth/moi')
        .set('Authorization', auth)
        .expect(401);
      expect(res.body.code).toBe('SESSION_INVALIDE');
    });

    it('refuse un jeton altéré ou absent', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const jeton = autorisation(ctx, lea);
      await request(ctx.http).get('/api/v1/auth/moi').set('Authorization', `${jeton}x`).expect(401);
      await request(ctx.http).get('/api/v1/auth/moi').expect(401);
    });
  });

  describe('UC-02 — récupération du mot de passe (RG-AUTH-04)', () => {
    it('répond à l’identique pour un email inconnu, sans envoyer de message', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const inconnu = await request(ctx.http)
        .post('/api/v1/auth/mot-de-passe-oublie')
        .send({ email: 'inconnu@test.fr' })
        .expect(202);
      const connu = await request(ctx.http)
        .post('/api/v1/auth/mot-de-passe-oublie')
        .send({ email: lea.email })
        .expect(202);
      expect(inconnu.body).toEqual(connu.body);
      await attendreEmail(lea.email);
      expect(MailService.boiteDEnvoi).toHaveLength(1);
    });

    it('réinitialise via un lien à usage unique et ferme les sessions existantes', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const ancienCookie = cookieRefresh(await login(lea.email, lea.motDePasse))!;
      await request(ctx.http).post('/api/v1/auth/mot-de-passe-oublie').send({ email: lea.email });

      const email = await attendreEmail(lea.email);
      const jeton = /jeton=([\w-]{43})/.exec(email.texte)![1];
      expect(email.texte).toContain('http://localhost:5173/reinitialisation?jeton=');
      expect(email.texte).toContain('30 minutes');

      const faible = await request(ctx.http)
        .post('/api/v1/auth/reinitialisation')
        .send({ jeton, motDePasse: 'Azerty123456!' })
        .expect(400);
      expect(faible.body.code).toBe('MOT_DE_PASSE_NON_CONFORME');
      expect(faible.body.details[0].messages[0]).toMatch(/courant|compromis/);

      const nouveau = 'Nouveau#Chemin-Vert42';
      await request(ctx.http)
        .post('/api/v1/auth/reinitialisation')
        .send({ jeton, motDePasse: nouveau })
        .expect(204);

      await login(lea.email, lea.motDePasse).expect(401);
      await login(lea.email, nouveau).expect(200);
      await request(ctx.http).post('/api/v1/auth/refresh').set('Cookie', ancienCookie).expect(401);

      const reutilise = await request(ctx.http)
        .post('/api/v1/auth/reinitialisation')
        .send({ jeton, motDePasse: 'Encore#Un-Autre42' })
        .expect(400);
      expect(reutilise.body.code).toBe('LIEN_INVALIDE');
    });

    it('refuse un lien expiré (30 minutes)', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const jeton = await ctx.app
        .get(AuthService)
        .creerJetonUsageUnique(lea.id, TypeJeton.REINITIALISATION);
      await ctx.prisma.jetonUsageUnique.updateMany({
        where: { utilisateurId: lea.id },
        data: { dateExpiration: new Date(Date.now() - 1000) },
      });
      await request(ctx.http)
        .post('/api/v1/auth/reinitialisation')
        .send({ jeton, motDePasse: 'Nouveau#Chemin-Vert42' })
        .expect(400);
    });
  });

  describe('Activation de compte et consentement (RG-RGPD-01)', () => {
    it('exige le consentement explicite et en conserve la preuve horodatée', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT, { motDePasse: null });
      await ctx.prisma.consentement.deleteMany({ where: { utilisateurId: lea.id } });
      const jeton = await ctx.app
        .get(AuthService)
        .creerJetonUsageUnique(lea.id, TypeJeton.ACTIVATION);

      const sansConsentement = await request(ctx.http)
        .post('/api/v1/auth/activation')
        .send({
          jeton,
          motDePasse: MOT_DE_PASSE_TEST,
          consentementGestionCompte: false,
          consentementSatisfaction: false,
        })
        .expect(400);
      expect(sansConsentement.body.details[0].champ).toBe('consentementGestionCompte');

      await request(ctx.http)
        .post('/api/v1/auth/activation')
        .send({
          jeton,
          motDePasse: MOT_DE_PASSE_TEST,
          consentementGestionCompte: true,
          consentementSatisfaction: true,
        })
        .expect(204);

      const consentements = await ctx.prisma.consentement.findMany({
        where: { utilisateurId: lea.id },
      });
      expect(consentements.map((c) => c.finalite).sort()).toEqual([
        'GESTION_COMPTE',
        'QUESTIONNAIRES_SATISFACTION',
      ]);
      expect(consentements[0]).toMatchObject({ versionMentions: 'v2.1', dateRetrait: null });
      await login(lea.email, MOT_DE_PASSE_TEST).expect(200);
    });
  });

  describe('Changement de mot de passe', () => {
    it('vérifie le mot de passe actuel et applique la politique', async () => {
      const lea = await creerUtilisateur(ctx, CodeRole.APPRENANT);
      const auth = autorisation(ctx, lea);
      const faux = await request(ctx.http)
        .patch('/api/v1/auth/mot-de-passe')
        .set('Authorization', auth)
        .send({ motDePasseActuel: 'pas-le-bon', nouveauMotDePasse: 'Nouveau#Chemin-Vert42' })
        .expect(400);
      expect(faux.body.code).toBe('MOT_DE_PASSE_ACTUEL_INCORRECT');

      await request(ctx.http)
        .patch('/api/v1/auth/mot-de-passe')
        .set('Authorization', auth)
        .send({ motDePasseActuel: lea.motDePasse, nouveauMotDePasse: 'Nouveau#Chemin-Vert42' })
        .expect(204);
      await login(lea.email, 'Nouveau#Chemin-Vert42').expect(200);
    });
  });
});
