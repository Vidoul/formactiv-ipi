import { api, type Parametres } from '../../api/client';
import type {
  CodeRole,
  FinaliteConsentement,
  Page,
  StatutCompte,
  StatutDemandeRgpd,
  TypeDemandeRgpd,
} from '../../api/types';

export interface Demande {
  id: string;
  numero: string;
  type: TypeDemandeRgpd;
  statut: StatutDemandeRgpd;
  message: string | null;
  reponse: string | null;
  dateDemande: string;
  dateTraitement: string | null;
}

export interface DemandeAdministration extends Demande {
  demandeur: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    statutCompte: StatutCompte;
  };
  traitant: { nom: string; prenom: string } | null;
}

export interface Consentement {
  id: string;
  finalite: FinaliteConsentement;
  versionMentions: string;
  dateConsentement: string;
  dateRetrait: string | null;
}

export interface MesDonnees {
  compte: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    role: CodeRole;
    statutCompte: StatutCompte;
    entreprise: { raisonSociale: string } | null;
    mfaActive: boolean;
    dateCreation: string;
    dateDerniereConnexion: string | null;
  };
  consentements: Consentement[];
  inscriptions: { formation: string; dateDebut: string; dateFin: string; statut: string }[];
  evaluations: { formation: string; competence: string; note: number; acquise: boolean }[];
  documents: { type: string; reference: string; dateGeneration: string }[];
  satisfaction: { formation: string; score: number; commentaire: string | null }[];
  demandes: Demande[];
}

export interface EntreeJournal {
  id: string;
  date: string;
  utilisateur: { id: string; nom: string; prenom: string; email: string } | null;
  action: string;
  typeObjet: string | null;
  idObjet: string | null;
  details: string | null;
  adresseIp: string | null;
}

export type StatutTraitement = 'EN_COURS' | 'TRAITEE' | 'REFUSEE';

export const clesRgpd = {
  mesDonnees: ['mes-donnees'] as const,
  demandes: (p: Parametres) => ['demandes-rgpd', p] as const,
  journal: (p: Parametres) => ['journal', p] as const,
};

export const rgpdApi = {
  mesDonnees: () => api.get<MesDonnees>('/rgpd/mes-donnees'),
  exporter: () => api.telecharger('/rgpd/mes-donnees/export', undefined, 'mes-donnees.json'),
  rectifier: (s: { nom?: string; prenom?: string }) =>
    api.patch<MesDonnees>('/rgpd/mes-donnees', s),
  donnerConsentement: (f: FinaliteConsentement) => api.post<MesDonnees>(`/rgpd/consentements/${f}`),
  retirerConsentement: (f: FinaliteConsentement) =>
    api.delete<MesDonnees>(`/rgpd/consentements/${f}`),
  demander: (type: TypeDemandeRgpd, message?: string) =>
    api.post<Demande>('/rgpd/demandes', { type, message }),

  demandes: (p: Parametres) => api.get<Page<DemandeAdministration>>('/rgpd/demandes', p),
  traiter: (id: string, statut: StatutTraitement, reponse?: string) =>
    api.patch<DemandeAdministration>(`/rgpd/demandes/${id}`, { statut, reponse }),
  journal: (p: Parametres) => api.get<Page<EntreeJournal>>('/journal', p),
};
