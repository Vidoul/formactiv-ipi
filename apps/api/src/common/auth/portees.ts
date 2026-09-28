import { CodeRole, Prisma, StatutInscription } from '@prisma/client';
import type { UtilisateurAuthentifie } from './utilisateur-authentifie';

/**
 * Portées de la matrice RBAC (chapitre 5) traduites en filtres Prisma : (t) tous,
 * (s) ses sessions, (e) limité à son entreprise, (p) son propre parcours.
 *
 * Elles sont appliquées dans les requêtes elles-mêmes : un objet hors portée n'est jamais chargé
 * (OWASP A01 — contrôle d'accès au niveau objet), et l'API répond 404 plutôt que 403 pour ne pas
 * révéler son existence.
 */
const AUCUN = { id: { in: [] as string[] } };

export function porteeSessions(acteur: UtilisateurAuthentifie): Prisma.SessionWhereInput {
  switch (acteur.role) {
    case CodeRole.ADMIN:
    case CodeRole.RESP_FORMATION:
      return {};
    case CodeRole.FORMATEUR:
      return { animations: { some: { formateurId: acteur.id } } };
    case CodeRole.APPRENANT:
      return {
        inscriptions: {
          some: { apprenantId: acteur.id, statut: { not: StatutInscription.ANNULEE } },
        },
      };
    case CodeRole.CLIENT_ENTREPRISE:
      return acteur.entrepriseId
        ? { inscriptions: { some: { apprenant: { entrepriseId: acteur.entrepriseId } } } }
        : AUCUN;
  }
}

export function porteeInscriptions(acteur: UtilisateurAuthentifie): Prisma.InscriptionWhereInput {
  switch (acteur.role) {
    case CodeRole.ADMIN:
    case CodeRole.RESP_FORMATION:
      return {};
    case CodeRole.FORMATEUR:
      return { session: { animations: { some: { formateurId: acteur.id } } } };
    case CodeRole.APPRENANT:
      return { apprenantId: acteur.id };
    case CodeRole.CLIENT_ENTREPRISE:
      return acteur.entrepriseId ? { apprenant: { entrepriseId: acteur.entrepriseId } } : AUCUN;
  }
}

/** L'acteur voit-il les coordonnées (email) des apprenants ? Minimisation RGPD (REQ-RGPD-001). */
export function voitLesCoordonnees(acteur: UtilisateurAuthentifie): boolean {
  return acteur.role === CodeRole.ADMIN || acteur.role === CodeRole.RESP_FORMATION;
}
