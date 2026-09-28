/**
 * Règles d'évaluation (UC-08) — fonctions pures.
 */

export const NOTE_MIN = 0;
export const NOTE_MAX = 20;

/** Arrondi au centième (précision de la colonne DECIMAL(4,2)). */
export function arrondirNote(note: number): number {
  return Math.round(note * 100) / 100;
}

/**
 * RG-EVAL-02 : une compétence est « acquise » lorsque la note atteint le seuil défini pour la
 * formation (10/20 par défaut, paramétrable par formation).
 */
export function estAcquise(note: number, seuil: number): boolean {
  return arrondirNote(note) >= seuil;
}

export function noteValide(note: number): boolean {
  return Number.isFinite(note) && note >= NOTE_MIN && note <= NOTE_MAX;
}

export interface Synthese {
  acquises: number;
  total: number;
}

/** Synthèse « 2 / 3 » des compétences acquises (maquettes 16 et 19). */
export function syntheseAcquisition(notes: (number | null | undefined)[], seuil: number): Synthese {
  return {
    acquises: notes.filter((n) => n !== null && n !== undefined && estAcquise(n, seuil)).length,
    total: notes.length,
  };
}
