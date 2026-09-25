/**
 * Types partagés avec l'API (contrat de nommage du chapitre 5 : mêmes noms que le MCD et l'API).
 * Les types propres à un domaine sont déclarés dans le dossier de la fonctionnalité.
 */

export type CodeRole = 'ADMIN' | 'RESP_FORMATION' | 'FORMATEUR' | 'APPRENANT' | 'CLIENT_ENTREPRISE';

export type StatutCompte = 'ACTIF' | 'VERROUILLE' | 'DESACTIVE' | 'ANONYMISE';
export type Modalite = 'PRESENTIEL' | 'DISTANCIEL' | 'HYBRIDE';
export type StatutFormation = 'BROUILLON' | 'PUBLIEE' | 'ARCHIVEE';
export type TypeReferentiel = 'RNCP' | 'INTERNE';
export type StatutInscription = 'EN_ATTENTE' | 'VALIDEE' | 'ANNULEE' | 'TERMINEE';
export type TypeDocument = 'ATTESTATION' | 'CERTIFICAT';
export type TypeDemandeRgpd = 'ACCES' | 'RECTIFICATION' | 'SUPPRESSION';
export type StatutDemandeRgpd = 'RECUE' | 'EN_COURS' | 'TRAITEE' | 'REFUSEE';
export type FinaliteConsentement = 'GESTION_COMPTE' | 'QUESTIONNAIRES_SATISFACTION';

export interface Page<T> {
  donnees: T[];
  total: number;
  page: number;
  limit: number;
}

export interface EntrepriseResume {
  id: string;
  raisonSociale: string;
}

/** Profil de l'utilisateur connecté (GET /auth/moi). */
export interface UtilisateurCourant {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: CodeRole;
  mfaActive: boolean;
  /** Vrai si le rôle impose la MFA et qu'elle n'est pas encore configurée (RG-AUTH-03). */
  mfaEnrolementRequis: boolean;
  entreprise: EntrepriseResume | null;
}
