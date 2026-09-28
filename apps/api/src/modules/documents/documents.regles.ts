import { StatutInscription, TypeDocument } from '@prisma/client';

/**
 * Règles de génération des documents (UC-09) — fonctions pures.
 */

export interface EtatAcquisition {
  statut: StatutInscription;
  /** Nombre de compétences visées par la formation. */
  competencesVisees: number;
  /** Nombre de compétences visées acquises par l'apprenant. */
  competencesAcquises: number;
}

/**
 * RG-CERT-01 : une attestation (de suivi) est générable dès que l'inscription est « terminée » ;
 * un certificat uniquement si toutes les compétences associées à la formation sont acquises
 * (inscription terminée, au moins une compétence visée).
 */
export function typesGenerables(etat: EtatAcquisition): TypeDocument[] {
  if (etat.statut !== StatutInscription.TERMINEE) return [];
  const certificat =
    etat.competencesVisees > 0 && etat.competencesAcquises >= etat.competencesVisees;
  return certificat
    ? [TypeDocument.CERTIFICAT, TypeDocument.ATTESTATION]
    : [TypeDocument.ATTESTATION];
}

/** Document proposé en priorité à l'écran 14 (UC-09 A1 : sinon seule l'attestation). */
export function documentPropose(etat: EtatAcquisition): TypeDocument | null {
  return typesGenerables(etat)[0] ?? null;
}

/** Motif lisible du refus de génération, ou null si le type est générable. */
export function motifRefus(type: TypeDocument, etat: EtatAcquisition): string | null {
  if (typesGenerables(etat).includes(type)) return null;
  if (etat.statut !== StatutInscription.TERMINEE) {
    return 'Le document est générable lorsque l’inscription est terminée (RG-CERT-01).';
  }
  return `Certificat indisponible : ${etat.competencesAcquises} compétence(s) acquise(s) sur ${etat.competencesVisees} (RG-CERT-01).`;
}

const PREFIXES: Record<TypeDocument, string> = {
  [TypeDocument.CERTIFICAT]: 'C',
  [TypeDocument.ATTESTATION]: 'A',
};

/** Préfixe « C-2026- » des références d'une année. */
export function prefixeReference(type: TypeDocument, annee: number): string {
  return `${PREFIXES[type]}-${annee}-`;
}

/**
 * RG-CERT-02 : identifiant unique lisible « C-2026-0412 » (C : certificat, A : attestation),
 * numéroté par type et par année.
 */
export function formaterReference(type: TypeDocument, annee: number, numero: number): string {
  if (!Number.isInteger(numero) || numero < 1) throw new Error('Numéro de document invalide');
  return `${prefixeReference(type, annee)}${String(numero).padStart(4, '0')}`;
}

export const MOTIF_REFERENCE = /^[AC]-\d{4}-\d{4,}$/;

const FONCTIONS: Record<string, string> = {
  ADMIN: 'Administrateur',
  RESP_FORMATION: 'Responsable formation',
};

/** Fonction de l'émetteur imprimée sur le document (RG-CERT-02). */
export function fonctionEmetteur(role: string): string {
  return FONCTIONS[role] ?? 'FORMACTIV';
}

/** Nom de fichier proposé au téléchargement (aucune donnée personnelle). */
export function nomFichierDocument(reference: string): string {
  return `formactiv-${reference}.pdf`;
}
