/**
 * Règles de gestion des sessions (UC-05) — fonctions pures sur des dates ISO « AAAA-MM-JJ ».
 */

export type StatutTemporel = 'A_VENIR' | 'EN_COURS' | 'TERMINEE';

/** RG-SESS-01 : une session porte une date de début et une date de fin, avec début <= fin. */
export function controlerDates(debut: string, fin: string): string | null {
  return debut <= fin
    ? null
    : 'La date de fin doit être postérieure ou égale à la date de début (RG-SESS-01).';
}

export function statutTemporel(debut: string, fin: string, jour: string): StatutTemporel {
  if (jour < debut) return 'A_VENIR';
  if (jour > fin) return 'TERMINEE';
  return 'EN_COURS';
}

export interface Periode {
  debut: string;
  fin: string;
}

/** Deux périodes se chevauchent-elles (bornes incluses) ? */
export function chevauchent(a: Periode, b: Periode): boolean {
  return a.debut <= b.fin && b.debut <= a.fin;
}

/** Premier jour commun à deux périodes qui se chevauchent (« Conflit le 15/09 », maquette 12). */
export function premierJourCommun(a: Periode, b: Periode): string {
  return a.debut > b.debut ? a.debut : b.debut;
}

/**
 * RG-SESS-02 : une session doit avoir au moins un formateur affecté avant sa date de début.
 * Une alerte est levée lorsqu'une session sans formateur commence dans le délai paramétré.
 */
export function alerteSansFormateur(
  nombreFormateurs: number,
  debut: string,
  jour: string,
  delaiJours: number,
): boolean {
  if (nombreFormateurs > 0 || jour > debut) return false;
  const limite = new Date(`${jour}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + delaiJours);
  return debut <= limite.toISOString().slice(0, 10);
}

/**
 * Nombre de notes attendues mais non saisies : chaque apprenant évaluable (inscription validée
 * ou terminée) doit être noté sur chaque compétence visée par la formation.
 */
export function notesManquantes(
  apprenantsEvaluables: number,
  competences: number,
  notesSaisies: number,
): number {
  return Math.max(0, apprenantsEvaluables * competences - notesSaisies);
}
