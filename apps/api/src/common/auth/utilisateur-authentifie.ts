import type { CodeRole } from '@prisma/client';

/**
 * Utilisateur authentifié attaché à la requête par la garde d'authentification, relu en base à
 * chaque requête : un compte désactivé ou dont le rôle change perd immédiatement ses accès.
 */
export interface UtilisateurAuthentifie {
  id: string;
  role: CodeRole;
  /** Entreprise de rattachement (apprenant) ou représentée (client entreprise) — portée (e). */
  entrepriseId: string | null;
  mfaActive: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    utilisateur?: UtilisateurAuthentifie;
  }
}
