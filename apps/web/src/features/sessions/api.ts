import { api, type Parametres } from '../../api/client';
import type {
  EntrepriseResume,
  Modalite,
  Page,
  StatutFormation,
  StatutInscription,
} from '../../api/types';

export type StatutTemporel = 'A_VENIR' | 'EN_COURS' | 'TERMINEE';

export interface Conflit {
  sessionId: string;
  formation: string;
  premierJour: string;
}

export interface FormateurAffecte {
  id: string;
  nom: string;
  prenom: string;
  conflits: Conflit[];
}

export interface Session {
  id: string;
  formation: { id: string; intitule: string; modalite: Modalite; statut: StatutFormation };
  dateDebut: string;
  dateFin: string;
  lieu: string | null;
  capaciteMax: number | null;
  statutTemporel: StatutTemporel;
  nombreInscrits: number;
  placesOccupees: number;
  formateurs: FormateurAffecte[];
  alerteSansFormateur: boolean;
  notesManquantes: number;
}

export interface Inscription {
  id: string;
  statut: StatutInscription;
  dateInscription: string;
  prerequisRequis: boolean;
  prerequisVerifies: boolean;
  apprenant: {
    id: string;
    nom: string;
    prenom: string;
    email?: string;
    entreprise: EntrepriseResume | null;
  };
  session: {
    id: string;
    dateDebut: string;
    dateFin: string;
    lieu: string | null;
    formation: { id: string; intitule: string };
  };
}

export interface SaisieSession {
  formationId?: string;
  dateDebut?: string;
  dateFin?: string;
  capaciteMax?: number | null;
  lieu?: string;
  formateurIds?: string[];
}

export const clesSessions = {
  sessions: (p?: Parametres) => ['sessions', p ?? {}] as const,
  session: (id: string) => ['session', id] as const,
  inscriptions: (p?: Parametres) => ['inscriptions', p ?? {}] as const,
  disponibilites: (p: Parametres) => ['disponibilites', p] as const,
};

export const sessionsApi = {
  lister: (p: Parametres = {}) => api.get<Page<Session>>('/sessions', p),
  detail: (id: string) => api.get<Session>(`/sessions/${id}`),
  creer: (s: SaisieSession) => api.post<Session>('/sessions', s),
  modifier: (id: string, s: SaisieSession) => api.patch<Session>(`/sessions/${id}`, s),
  supprimer: (id: string) => api.delete(`/sessions/${id}`),
  affecter: (id: string, formateurId: string) =>
    api.post<Session>(`/sessions/${id}/formateurs/${formateurId}`),
  retirer: (id: string, formateurId: string) =>
    api.delete<Session>(`/sessions/${id}/formateurs/${formateurId}`),
  disponibilites: (debut: string, fin: string, sessionExclue?: string) =>
    api.get<FormateurAffecte[]>('/formateurs/disponibilites', { debut, fin, sessionExclue }),

  inscriptions: (p: Parametres) => api.get<Page<Inscription>>('/inscriptions', p),
  inscrire: (sessionId: string, apprenantId: string) =>
    api.post<{ inscription: Inscription; avertissements: string[] }>(
      `/sessions/${sessionId}/inscriptions`,
      { apprenantId },
    ),
  modifierInscription: (
    id: string,
    s: { statut?: StatutInscription; prerequisVerifies?: boolean },
  ) => api.patch<Inscription>(`/inscriptions/${id}`, s),
};

export const LIBELLES_TEMPOREL: Record<StatutTemporel, string> = {
  A_VENIR: 'À venir',
  EN_COURS: 'En cours',
  TERMINEE: 'Terminée',
};
