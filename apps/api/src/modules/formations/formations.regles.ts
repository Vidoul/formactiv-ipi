import { StatutFormation } from '@prisma/client';

/**
 * Règles de gestion du catalogue (UC-04) — fonctions pures.
 */

/**
 * RG-FORM-03 : cycle de vie brouillon → publiée → archivée. Une formation archivée peut être
 * republiée ; une formation publiée ne revient en brouillon que si aucune session n'existe.
 */
const TRANSITIONS: Record<StatutFormation, StatutFormation[]> = {
  BROUILLON: [StatutFormation.PUBLIEE],
  PUBLIEE: [StatutFormation.ARCHIVEE, StatutFormation.BROUILLON],
  ARCHIVEE: [StatutFormation.PUBLIEE],
};

export interface EtatFormation {
  statut: StatutFormation;
  nombreCompetences: number;
  nombreSessions: number;
}

/** @returns le motif du refus, ou null si la transition est permise. */
export function controlerTransition(etat: EtatFormation, cible: StatutFormation): string | null {
  if (etat.statut === cible) return null;
  if (!TRANSITIONS[etat.statut].includes(cible)) {
    return `Transition ${etat.statut} → ${cible} non autorisée (RG-FORM-03).`;
  }
  if (cible === StatutFormation.PUBLIEE && etat.nombreCompetences === 0) {
    return 'Une formation doit viser au moins une compétence pour être publiée (RG-FORM-02).';
  }
  if (cible === StatutFormation.BROUILLON && etat.nombreSessions > 0) {
    return 'Une formation qui possède des sessions ne peut pas revenir en brouillon : archivez-la.';
  }
  return null;
}

/** RG-FORM-03 : seules les formations publiées sont visibles des apprenants et des clients. */
export function visibleDuPublic(statut: StatutFormation): boolean {
  return statut === StatutFormation.PUBLIEE;
}

/** RG-FORM-01 : prérequis obligatoire, « Aucun » par défaut. */
export function normaliserPrerequis(prerequis: string | undefined | null): string {
  const texte = prerequis?.trim();
  return texte ? texte : 'Aucun';
}

/** Formation supprimable physiquement : brouillon sans aucune session (sinon, archivage). */
export function estSupprimable(etat: EtatFormation): boolean {
  return etat.statut === StatutFormation.BROUILLON && etat.nombreSessions === 0;
}
