import { api, telechargerDepuisUrl, type Parametres } from '../../api/client';
import type { Page, StatutInscription, TypeDocument, TypeReferentiel } from '../../api/types';

export interface DocumentResume {
  id: string;
  type: TypeDocument;
  reference: string;
  dateGeneration: string;
}

export interface DocumentDetail extends DocumentResume {
  inscriptionId: string;
  apprenant: { id: string; nom: string; prenom: string };
  formation: { id: string; intitule: string };
  session: { id: string; dateDebut: string; dateFin: string };
  emetteur: { nom: string; prenom: string };
}

export interface LienTelechargement {
  url: string;
  expireLe: string;
  nomFichier: string;
}

export interface BilanDocumentsSession {
  session: {
    id: string;
    dateDebut: string;
    dateFin: string;
    terminee: boolean;
    formation: { id: string; intitule: string };
  };
  peutGenerer: boolean;
  lignes: {
    inscriptionId: string;
    statut: StatutInscription;
    apprenant: { id: string; nom: string; prenom: string };
    competencesAcquises: number;
    competencesVisees: number;
    typesGenerables: TypeDocument[];
    documentPropose: TypeDocument | null;
    documents: DocumentResume[];
  }[];
}

export interface EtapeParcours {
  inscriptionId: string;
  statut: StatutInscription;
  dateInscription: string;
  formation: { id: string; intitule: string; dureeHeures: number };
  session: {
    id: string;
    dateDebut: string;
    dateFin: string;
    lieu: string | null;
    enCours: boolean;
  };
  moyenne: number | null;
  partielle: boolean;
  competencesAcquises: number;
  competencesVisees: number;
  evaluations: {
    competenceId: string;
    libelle: string;
    note: number | null;
    acquise: boolean;
    dateSaisie: string | null;
  }[];
  documents: DocumentResume[];
}

export interface Parcours {
  apprenant: { id: string; nom: string; prenom: string };
  etapes: EtapeParcours[];
  competences: {
    id: string;
    libelle: string;
    typeReferentiel: TypeReferentiel;
    codeRncp: string | null;
    meilleureNote: number | null;
    acquise: boolean;
    progression: number;
  }[];
}

export type JeuExport = 'inscriptions' | 'resultats' | 'evaluations';
export type FormatExport = 'csv' | 'pdf';

export interface DemandeExport {
  jeu: JeuExport;
  format: FormatExport;
  sessionId?: string;
  formationId?: string;
  entrepriseId?: string;
  du?: string;
  au?: string;
}

export const clesDocuments = {
  documents: (p?: Parametres) => ['documents', p ?? {}] as const,
  bilan: (sessionId: string) => ['bilan-documents', sessionId] as const,
  parcours: (utilisateurId: string) => ['parcours', utilisateurId] as const,
};

export const documentsApi = {
  lister: (p: Parametres = {}) => api.get<Page<DocumentDetail>>('/documents', p),
  bilan: (sessionId: string) => api.get<BilanDocumentsSession>(`/sessions/${sessionId}/documents`),
  generer: (inscriptionId: string, type: TypeDocument) =>
    api.post<DocumentDetail>(`/inscriptions/${inscriptionId}/documents`, { type }),
  parcours: (utilisateurId: string) => api.get<Parcours>(`/utilisateurs/${utilisateurId}/parcours`),

  /** UC-10 : obtient une URL signée de courte durée puis déclenche le téléchargement. */
  async telecharger(documentId: string): Promise<void> {
    const lien = await api.get<LienTelechargement>(`/documents/${documentId}`);
    telechargerDepuisUrl(lien.url, lien.nomFichier);
  },

  /** UC-11 : export PDF ou CSV limité à la portée du rôle (RG-EXP-01). */
  exporter: (demande: DemandeExport) =>
    api.telecharger('/exports', { ...demande }, `formactiv-${demande.jeu}.${demande.format}`),
};
