/**
 * Calculs du parcours de formation (RG-HIST-01, écran 19) — fonctions pures.
 */

/** Moyenne des notes saisies, arrondie au dixième (null si aucune note). */
export function moyenne(notes: number[]): number | null {
  if (notes.length === 0) return null;
  const somme = notes.reduce((s, n) => s + n, 0);
  return Math.round((somme / notes.length) * 10) / 10;
}

/**
 * Progression vers l'acquisition d'une compétence, en pourcentage (barres de l'écran 19) :
 * 100 % lorsque la note atteint le seuil, proportionnelle en deçà, 0 % sans évaluation.
 */
export function progression(note: number | null, seuil: number): number {
  if (note === null) return 0;
  if (seuil <= 0) return 100;
  return Math.min(100, Math.round((note / seuil) * 100));
}

export interface EvaluationCompetence {
  competenceId: string;
  note: number;
  acquise: boolean;
  seuil: number;
}

export interface BilanCompetence {
  meilleureNote: number | null;
  acquise: boolean;
  progression: number;
}

/**
 * Synthèse d'une compétence évaluée dans plusieurs formations : une compétence acquise le reste,
 * la progression retenue est la meilleure obtenue.
 */
export function bilanCompetence(evaluations: EvaluationCompetence[]): BilanCompetence {
  if (evaluations.length === 0) return { meilleureNote: null, acquise: false, progression: 0 };
  return {
    meilleureNote: Math.max(...evaluations.map((e) => e.note)),
    acquise: evaluations.some((e) => e.acquise),
    progression: Math.max(
      ...evaluations.map((e) => (e.acquise ? 100 : progression(e.note, e.seuil))),
    ),
  };
}
