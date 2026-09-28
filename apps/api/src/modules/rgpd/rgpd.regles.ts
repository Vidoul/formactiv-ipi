import { FinaliteConsentement, StatutDemandeRgpd } from '@prisma/client';

/**
 * Règles RGPD (UC-13, UC-14, RG-RGPD-01..04) — fonctions pures.
 */

/** Demandes encore ouvertes (file de traitement de l'écran 07). */
export const STATUTS_OUVERTS: StatutDemandeRgpd[] = [
  StatutDemandeRgpd.RECUE,
  StatutDemandeRgpd.EN_COURS,
];

const TRANSITIONS: Record<StatutDemandeRgpd, StatutDemandeRgpd[]> = {
  [StatutDemandeRgpd.RECUE]: [
    StatutDemandeRgpd.EN_COURS,
    StatutDemandeRgpd.TRAITEE,
    StatutDemandeRgpd.REFUSEE,
  ],
  [StatutDemandeRgpd.EN_COURS]: [StatutDemandeRgpd.TRAITEE, StatutDemandeRgpd.REFUSEE],
  [StatutDemandeRgpd.TRAITEE]: [],
  [StatutDemandeRgpd.REFUSEE]: [],
};

/**
 * Cycle d'une demande : reçue → en cours → traitée ou refusée ; une demande clôturée ne change
 * plus. Un refus est toujours motivé (réponse obligatoire).
 * @returns un message d'erreur, ou null si la transition est permise.
 */
export function controlerTraitement(
  actuel: StatutDemandeRgpd,
  cible: StatutDemandeRgpd,
  reponse?: string | null,
): string | null {
  if (!TRANSITIONS[actuel].includes(cible)) {
    return actuel === StatutDemandeRgpd.TRAITEE || actuel === StatutDemandeRgpd.REFUSEE
      ? 'Cette demande est clôturée.'
      : `Transition impossible : ${actuel} vers ${cible}.`;
  }
  if (cible === StatutDemandeRgpd.REFUSEE && !reponse?.trim()) {
    return 'Un refus doit être motivé.';
  }
  return null;
}

export function estCloturee(statut: StatutDemandeRgpd): boolean {
  return !STATUTS_OUVERTS.includes(statut);
}

/** Numéro lisible « D-126 » communiqué au demandeur. */
export function numeroDemande(numero: number): string {
  return `D-${numero}`;
}

/**
 * Finalités révocables en libre-service. Le consentement « gestion du compte » conditionne
 * l'existence même du compte : y renoncer passe par une demande de suppression (RG-RGPD-02).
 */
export function finaliteRevocable(finalite: FinaliteConsentement): boolean {
  return finalite === FinaliteConsentement.QUESTIONNAIRES_SATISFACTION;
}

/** Date à partir de laquelle une donnée de `mois` mois est échue (RG-RGPD-04). */
export function echeance(maintenant: Date, mois: number): Date {
  const d = new Date(maintenant.getTime());
  d.setUTCMonth(d.getUTCMonth() - mois);
  return d;
}

/** Durée minimale de conservation du journal, imposée aussi par la base (trigger). */
export const JOURNAL_MOIS_MINIMUM = 6;
