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

/**
 * Libellés des actions du journal d'audit (RG-LOG-01). Codes inconnus (actions ajoutées côté API
 * avant une mise à jour du front) : affichés tels quels via `libelleAction`.
 */
export const ACTIONS_JOURNAL: Record<string, string> = {
  CONNEXION_REUSSIE: 'Connexion réussie',
  CONNEXION_ECHOUEE: 'Échec de connexion',
  VERROUILLAGE_COMPTE: 'Verrouillage de compte',
  DECONNEXION: 'Déconnexion',
  MFA_ECHEC: 'Échec de double authentification',
  MFA_ACTIVATION: 'Activation de la double authentification',
  MFA_DESACTIVATION: 'Désactivation de la double authentification',
  REINITIALISATION_DEMANDEE: 'Réinitialisation de mot de passe demandée',
  MOT_DE_PASSE_MODIFIE: 'Mot de passe modifié',
  ACTIVATION_COMPTE: 'Activation de compte',
  REUTILISATION_JETON: 'Réutilisation de jeton détectée',
  ACCES_REFUSE: 'Accès refusé',
  CREATION_COMPTE: 'Création de compte',
  MODIFICATION_COMPTE: 'Modification de compte',
  CHANGEMENT_ROLE: 'Changement de rôle',
  DEVERROUILLAGE_COMPTE: 'Déverrouillage de compte',
  SUPPRESSION_COMPTE: 'Suppression de compte',
  ANONYMISATION_COMPTE: 'Anonymisation de compte',
  CREATION_ENTREPRISE: 'Création d’entreprise',
  MODIFICATION_ENTREPRISE: 'Modification d’entreprise',
  MODIFICATION_PARAMETRE: 'Modification de paramètre',
  CREATION_FORMATION: 'Création de formation',
  MODIFICATION_FORMATION: 'Modification de formation',
  CHANGEMENT_STATUT_FORMATION: 'Changement de statut de formation',
  SUPPRESSION_FORMATION: 'Suppression de formation',
  CREATION_COMPETENCE: 'Création de compétence',
  MODIFICATION_COMPETENCE: 'Modification de compétence',
  SUPPRESSION_COMPETENCE: 'Suppression de compétence',
  CREATION_SESSION: 'Création de session',
  MODIFICATION_SESSION: 'Modification de session',
  SUPPRESSION_SESSION: 'Suppression de session',
  AFFECTATION_FORMATEUR: 'Affectation de formateur',
  RETRAIT_FORMATEUR: 'Retrait de formateur',
  INSCRIPTION_APPRENANT: 'Inscription d’apprenant',
  CHANGEMENT_STATUT_INSCRIPTION: 'Changement de statut d’inscription',
  SAISIE_NOTE: 'Saisie de note',
  CORRECTION_NOTE: 'Correction de note',
  GENERATION_DOCUMENT: 'Génération de document',
  TELECHARGEMENT_DOCUMENT: 'Téléchargement de document',
  INTEGRITE_DOCUMENT: 'Anomalie d’intégrité de document',
  EXPORT_CSV: 'Export CSV',
  EXPORT_PDF: 'Export PDF',
  REPONSE_SATISFACTION: 'Réponse au questionnaire de satisfaction',
  CONSULTATION_DONNEES_PERSONNELLES: 'Consultation de ses données',
  EXPORT_DONNEES_PERSONNELLES: 'Export de ses données',
  RECTIFICATION_DONNEES: 'Rectification de données',
  CONSENTEMENT_DONNE: 'Consentement donné',
  CONSENTEMENT_RETIRE: 'Consentement retiré',
  DEMANDE_RGPD: 'Demande RGPD',
  TRAITEMENT_DEMANDE_RGPD: 'Traitement de demande RGPD',
  PURGE_CONSERVATION: 'Purge de conservation',
};

export function libelleAction(code: string): string {
  return ACTIONS_JOURNAL[code] ?? code;
}
