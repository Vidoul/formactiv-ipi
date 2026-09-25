import { requeteApi } from '../api/client';
import type { UtilisateurCourant } from '../api/types';

export interface Session {
  accessToken: string;
  expireDans: number;
  utilisateur: UtilisateurCourant;
}

export type ReponseConnexion =
  ({ mfaRequis: false } & Session) | { mfaRequis: true; jetonMfa: string };

export interface EnrolementMfa {
  secret: string;
  uri: string;
  qrCode: string;
}

/** Appels d'authentification : jamais de rafraîchissement automatique sur ces routes. */
const sansRafraichissement = { sansRafraichissement: true } as const;

export const authApi = {
  connecter: (email: string, motDePasse: string) =>
    requeteApi<ReponseConnexion>('/auth/login', {
      methode: 'POST',
      corps: { email, motDePasse },
      ...sansRafraichissement,
    }),

  verifierMfa: (jetonMfa: string, code: string) =>
    requeteApi<Session>('/auth/mfa', {
      methode: 'POST',
      corps: { jetonMfa, code },
      ...sansRafraichissement,
    }),

  rafraichir: () =>
    requeteApi<Session>('/auth/refresh', { methode: 'POST', corps: {}, ...sansRafraichissement }),

  deconnecter: () =>
    requeteApi<void>('/auth/logout', { methode: 'POST', corps: {}, ...sansRafraichissement }),

  motDePasseOublie: (email: string) =>
    requeteApi<{ message: string }>('/auth/mot-de-passe-oublie', {
      methode: 'POST',
      corps: { email },
      ...sansRafraichissement,
    }),

  reinitialiser: (jeton: string, motDePasse: string) =>
    requeteApi<void>('/auth/reinitialisation', {
      methode: 'POST',
      corps: { jeton, motDePasse },
      ...sansRafraichissement,
    }),

  activer: (
    jeton: string,
    motDePasse: string,
    consentementGestionCompte: boolean,
    consentementSatisfaction: boolean,
  ) =>
    requeteApi<void>('/auth/activation', {
      methode: 'POST',
      corps: { jeton, motDePasse, consentementGestionCompte, consentementSatisfaction },
      ...sansRafraichissement,
    }),

  moi: () => requeteApi<UtilisateurCourant>('/auth/moi'),

  changerMotDePasse: (motDePasseActuel: string, nouveauMotDePasse: string) =>
    requeteApi<void>('/auth/mot-de-passe', {
      methode: 'PATCH',
      corps: { motDePasseActuel, nouveauMotDePasse },
    }),

  demarrerEnrolementMfa: () =>
    requeteApi<EnrolementMfa>('/auth/mfa/enrolement', { methode: 'POST', corps: {} }),

  confirmerEnrolementMfa: (code: string) =>
    requeteApi<UtilisateurCourant>('/auth/mfa/enrolement/confirmation', {
      methode: 'POST',
      corps: { code },
    }),

  desactiverMfa: (motDePasse: string, code: string) =>
    requeteApi<UtilisateurCourant>('/auth/mfa/desactivation', {
      methode: 'POST',
      corps: { motDePasse, code },
    }),
};
