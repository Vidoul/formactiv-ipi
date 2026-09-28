import { CodeRole } from '@prisma/client';

/**
 * Règles de gestion des comptes (UC-03), sous forme de fonctions pures testables.
 */

/**
 * H2 / REQ-FUNC-018 : un Apprenant peut être rattaché à zéro ou une entreprise cliente ; un compte
 * Client entreprise représente obligatoirement une entreprise ; les autres profils (personnel de
 * FORMACTIV) ne sont rattachés à aucune entreprise.
 * @returns un message d'erreur, ou null si le rattachement est cohérent.
 */
export function controlerRattachement(role: CodeRole, entrepriseId: string | null): string | null {
  if (role === CodeRole.CLIENT_ENTREPRISE && !entrepriseId) {
    return 'Un compte Client entreprise doit être rattaché à une entreprise.';
  }
  if (role !== CodeRole.CLIENT_ENTREPRISE && role !== CodeRole.APPRENANT && entrepriseId) {
    return 'Seuls les apprenants et les clients entreprise sont rattachés à une entreprise.';
  }
  return null;
}

/**
 * Matrice RBAC (chapitre 5, [À VALIDER]) : l'Administrateur gère tous les comptes ; le
 * Responsable formation crée et modifie les comptes, sauf ceux des administrateurs, et ne peut
 * pas attribuer le rôle Administrateur.
 */
export function peutGererCompte(
  roleActeur: CodeRole,
  roleCibleActuel: CodeRole | null,
  roleCibleDemande?: CodeRole,
): boolean {
  if (roleActeur === CodeRole.ADMIN) return true;
  if (roleActeur !== CodeRole.RESP_FORMATION) return false;
  if (roleCibleActuel === CodeRole.ADMIN) return false;
  return roleCibleDemande !== CodeRole.ADMIN;
}

export interface CompteursHistorique {
  inscriptions: number;
  animations: number;
  evaluationsSaisies: number;
  documentsEmis: number;
  actionsJournalisees: number;
  demandesRgpd: number;
}

/**
 * RG-CPT-02 : la suppression d'un compte ayant un historique (formation, actions tracées,
 * demandes RGPD) entraîne son anonymisation plutôt qu'un effacement physique destructeur de
 * l'historique métier ; un compte sans aucun historique est supprimé.
 */
export function doitEtreAnonymise(c: CompteursHistorique): boolean {
  return Object.values(c).some((n) => n > 0);
}

/** Adresse de substitution d'un compte anonymisé (unique, non routable : domaine .invalid). */
export function emailAnonyme(id: string): string {
  return `anonyme-${id}@anonymise.invalid`;
}
