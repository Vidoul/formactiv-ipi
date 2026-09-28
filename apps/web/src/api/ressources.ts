import { api, type Parametres } from './client';
import type { CodeRole, EntrepriseResume, Page, StatutCompte } from './types';

/**
 * Ressources partagées entre plusieurs fonctionnalités (comptes, entreprises), avec leurs
 * clés de cache TanStack Query.
 */

export interface UtilisateurResume {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: CodeRole;
  statut: StatutCompte;
  entreprise: EntrepriseResume | null;
}

export interface UtilisateurDetail extends UtilisateurResume {
  mfaActive: boolean;
  active: boolean;
  verrouilleJusquA: string | null;
  dateDerniereConnexion: string | null;
  dateCreation: string;
}

export interface Entreprise {
  id: string;
  raisonSociale: string;
  siret: string | null;
  emailContact: string;
  nombreComptes: number;
  dateCreation: string;
}

export interface SaisieUtilisateur {
  nom?: string;
  prenom?: string;
  email?: string;
  role?: CodeRole;
  entrepriseId?: string | null;
  statut?: 'ACTIF' | 'DESACTIVE';
  mfaActive?: false;
}

export interface SaisieEntreprise {
  raisonSociale: string;
  siret: string | null;
  emailContact: string;
}

export const cles = {
  utilisateurs: (params?: Parametres) => ['utilisateurs', params ?? {}] as const,
  utilisateur: (id: string) => ['utilisateur', id] as const,
  entreprises: (params?: Parametres) => ['entreprises', params ?? {}] as const,
};

export const utilisateursApi = {
  lister: (params: Parametres) => api.get<Page<UtilisateurResume>>('/utilisateurs', params),
  detail: (id: string) => api.get<UtilisateurDetail>(`/utilisateurs/${id}`),
  creer: (saisie: SaisieUtilisateur) => api.post<UtilisateurDetail>('/utilisateurs', saisie),
  modifier: (id: string, saisie: SaisieUtilisateur) =>
    api.patch<UtilisateurDetail>(`/utilisateurs/${id}`, saisie),
  supprimer: (id: string) =>
    api.delete<{ resultat: 'SUPPRIME' | 'ANONYMISE' }>(`/utilisateurs/${id}`),
  renvoyerActivation: (id: string) => api.post<void>(`/utilisateurs/${id}/activation`),
};

export const entreprisesApi = {
  lister: (params: Parametres = {}) => api.get<Page<Entreprise>>('/entreprises', params),
  toutes: () => api.get<Page<Entreprise>>('/entreprises', { limit: 100 }),
  creer: (saisie: SaisieEntreprise) => api.post<Entreprise>('/entreprises', saisie),
  modifier: (id: string, saisie: Partial<SaisieEntreprise>) =>
    api.patch<Entreprise>(`/entreprises/${id}`, saisie),
  supprimer: (id: string) => api.delete(`/entreprises/${id}`),
};
