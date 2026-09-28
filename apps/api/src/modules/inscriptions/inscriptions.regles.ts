import { StatutInscription } from '@prisma/client';

/**
 * Règles de gestion des inscriptions (UC-06) — fonctions pures.
 */

/** Inscriptions qui occupent une place dans la session (RG-SESS-03). */
export const STATUTS_OCCUPANT_UNE_PLACE: StatutInscription[] = [
  StatutInscription.EN_ATTENTE,
  StatutInscription.VALIDEE,
];

/** Inscriptions comptées comme « inscrits » (maquettes : « 9 inscrits / 12 places »). */
export const STATUTS_INSCRITS: StatutInscription[] = [
  StatutInscription.EN_ATTENTE,
  StatutInscription.VALIDEE,
  StatutInscription.TERMINEE,
];

/** Inscriptions dont les apprenants peuvent être évalués (UC-08). */
export const STATUTS_EVALUABLES: StatutInscription[] = [
  StatutInscription.VALIDEE,
  StatutInscription.TERMINEE,
];

/** RG-INSC-02 : cycle en attente → validée → (annulée / terminée). */
const TRANSITIONS: Record<StatutInscription, StatutInscription[]> = {
  EN_ATTENTE: [StatutInscription.VALIDEE, StatutInscription.ANNULEE],
  VALIDEE: [StatutInscription.TERMINEE, StatutInscription.ANNULEE],
  ANNULEE: [],
  TERMINEE: [],
};

export interface ContexteTransition {
  /** La session est-elle terminée (date de fin passée) ? */
  sessionTerminee: boolean;
  /** La formation a-t-elle des prérequis (autres que « Aucun ») ? */
  prerequisRequis: boolean;
  /** Prérequis vérifiés (déjà tracés ou confirmés dans la requête). */
  prerequisVerifies: boolean;
}

export interface RefusTransition {
  code: string;
  message: string;
}

export function controlerTransition(
  actuel: StatutInscription,
  cible: StatutInscription,
  ctx: ContexteTransition,
): RefusTransition | null {
  if (actuel === cible) return null;
  if (!TRANSITIONS[actuel].includes(cible)) {
    return {
      code: 'TRANSITION_STATUT_INVALIDE',
      message: `Passage de ${actuel} à ${cible} non autorisé (RG-INSC-02).`,
    };
  }
  // RG-INSC-03 : avertissement à la validation lorsque les prérequis ne sont pas tracés.
  if (cible === StatutInscription.VALIDEE && ctx.prerequisRequis && !ctx.prerequisVerifies) {
    return {
      code: 'PREREQUIS_A_VERIFIER',
      message:
        'Les prérequis de la formation ne sont pas tracés comme acquis pour cet apprenant : confirmez leur vérification pour valider (RG-INSC-03).',
    };
  }
  if (cible === StatutInscription.TERMINEE && !ctx.sessionTerminee) {
    return {
      code: 'SESSION_NON_TERMINEE',
      message: 'Une inscription ne peut être terminée qu’à l’issue de la session.',
    };
  }
  return null;
}

/** RG-SESS-03 : capacité optionnelle ; l'inscription est refusée au-delà. */
export function capaciteAtteinte(capaciteMax: number | null, placesOccupees: number): boolean {
  return capaciteMax !== null && placesOccupees >= capaciteMax;
}

/** Une formation a-t-elle des prérequis (RG-FORM-01 : « Aucun » sinon) ? */
export function aDesPrerequis(prerequis: string): boolean {
  const texte = prerequis.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
  return texte !== '' && texte !== 'aucun' && texte !== 'aucune' && texte !== 'neant';
}
