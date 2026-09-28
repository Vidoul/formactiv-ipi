import { api, type Parametres } from '../../api/client';
import type { Modalite, Page, StatutFormation, TypeReferentiel } from '../../api/types';

export interface CompetenceResume {
  id: string;
  libelle: string;
  typeReferentiel: TypeReferentiel;
  codeRncp: string | null;
}

export interface Competence extends CompetenceResume {
  nombreFormations: number;
}

export interface FormationResume {
  id: string;
  intitule: string;
  dureeHeures: number;
  modalite: Modalite;
  prerequis: string;
  statut: StatutFormation;
  seuilAcquisition: number;
  nombreCompetences: number;
  nombreSessions: number;
}

export interface FormationDetail extends FormationResume {
  competences: CompetenceResume[];
  dateCreation: string;
  dateModification: string;
}

export interface SaisieFormation {
  intitule?: string;
  dureeHeures?: number;
  modalite?: Modalite;
  prerequis?: string;
  seuilAcquisition?: number;
  statut?: StatutFormation;
  competenceIds?: string[];
}

export interface SaisieCompetence {
  libelle: string;
  typeReferentiel: TypeReferentiel;
  codeRncp?: string | null;
}

export const clesCatalogue = {
  formations: (p?: Parametres) => ['formations', p ?? {}] as const,
  formation: (id: string) => ['formation', id] as const,
  competences: (p?: Parametres) => ['competences', p ?? {}] as const,
};

export const catalogueApi = {
  formations: (p: Parametres = {}) => api.get<Page<FormationResume>>('/formations', p),
  formation: (id: string) => api.get<FormationDetail>(`/formations/${id}`),
  creerFormation: (s: SaisieFormation) => api.post<FormationDetail>('/formations', s),
  modifierFormation: (id: string, s: SaisieFormation) =>
    api.patch<FormationDetail>(`/formations/${id}`, s),
  supprimerFormation: (id: string) => api.delete(`/formations/${id}`),
  ajouterCompetence: (id: string, competenceId: string) =>
    api.post<FormationDetail>(`/formations/${id}/competences`, { competenceId }),
  retirerCompetence: (id: string, competenceId: string) =>
    api.delete<FormationDetail>(`/formations/${id}/competences/${competenceId}`),

  competences: (p: Parametres = {}) => api.get<Page<Competence>>('/competences', p),
  toutesCompetences: () => api.get<Page<Competence>>('/competences', { limit: 100 }),
  creerCompetence: (s: SaisieCompetence) => api.post<Competence>('/competences', s),
  modifierCompetence: (id: string, s: Partial<SaisieCompetence>) =>
    api.patch<Competence>(`/competences/${id}`, s),
  supprimerCompetence: (id: string) => api.delete(`/competences/${id}`),
};

/** Étiquette courte d'une compétence : « RNCP - Sécuriser un SI » (maquette 10). */
export function etiquetteCompetence(c: CompetenceResume): string {
  return `${c.typeReferentiel === 'RNCP' ? 'RNCP' : 'Interne'} - ${c.libelle}`;
}
