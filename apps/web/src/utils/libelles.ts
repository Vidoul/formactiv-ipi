import type {
  CodeRole,
  FinaliteConsentement,
  Modalite,
  StatutCompte,
  StatutDemandeRgpd,
  StatutFormation,
  StatutInscription,
  TypeDemandeRgpd,
  TypeDocument,
  TypeReferentiel,
} from '../api/types';

/** Variantes visuelles des badges (toujours accompagnées d'un libellé texte, RGAA 3.1). */
export type VarianteBadge = 'succes' | 'alerte' | 'info' | 'neutre' | 'danger';

interface Libelle {
  libelle: string;
  variante: VarianteBadge;
}

export const ROLES: Record<CodeRole, string> = {
  ADMIN: 'Administrateur',
  RESP_FORMATION: 'Responsable formation',
  FORMATEUR: 'Formateur',
  APPRENANT: 'Apprenant',
  CLIENT_ENTREPRISE: 'Client entreprise',
};

export const MODALITES: Record<Modalite, string> = {
  PRESENTIEL: 'Présentiel',
  DISTANCIEL: 'Distanciel',
  HYBRIDE: 'Hybride',
};

export const REFERENTIELS: Record<TypeReferentiel, string> = {
  RNCP: 'RNCP',
  INTERNE: 'Interne',
};

export const STATUTS_COMPTE: Record<StatutCompte, Libelle> = {
  ACTIF: { libelle: 'Actif', variante: 'succes' },
  VERROUILLE: { libelle: 'Verrouillé', variante: 'alerte' },
  DESACTIVE: { libelle: 'Désactivé', variante: 'neutre' },
  ANONYMISE: { libelle: 'Anonymisé', variante: 'neutre' },
};

export const STATUTS_FORMATION: Record<StatutFormation, Libelle> = {
  BROUILLON: { libelle: 'Brouillon', variante: 'alerte' },
  PUBLIEE: { libelle: 'Publiée', variante: 'succes' },
  ARCHIVEE: { libelle: 'Archivée', variante: 'neutre' },
};

export const STATUTS_INSCRIPTION: Record<StatutInscription, Libelle> = {
  EN_ATTENTE: { libelle: 'En attente', variante: 'info' },
  VALIDEE: { libelle: 'Validée', variante: 'succes' },
  ANNULEE: { libelle: 'Annulée', variante: 'neutre' },
  TERMINEE: { libelle: 'Terminée', variante: 'succes' },
};

export const TYPES_DOCUMENT: Record<TypeDocument, Libelle> = {
  ATTESTATION: { libelle: 'Attestation', variante: 'info' },
  CERTIFICAT: { libelle: 'Certificat', variante: 'succes' },
};

export const TYPES_DEMANDE_RGPD: Record<TypeDemandeRgpd, string> = {
  ACCES: 'Accès',
  RECTIFICATION: 'Rectification',
  SUPPRESSION: 'Suppression',
};

export const STATUTS_DEMANDE_RGPD: Record<StatutDemandeRgpd, Libelle> = {
  RECUE: { libelle: 'Reçue', variante: 'info' },
  EN_COURS: { libelle: 'En cours', variante: 'alerte' },
  TRAITEE: { libelle: 'Traitée', variante: 'succes' },
  REFUSEE: { libelle: 'Refusée', variante: 'danger' },
};

export const FINALITES_CONSENTEMENT: Record<FinaliteConsentement, string> = {
  GESTION_COMPTE: 'Gestion du compte et du parcours',
  QUESTIONNAIRES_SATISFACTION: 'Questionnaires de satisfaction',
};
