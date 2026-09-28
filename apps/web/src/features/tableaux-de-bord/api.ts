import { api, type Parametres } from '../../api/client';
import type { Modalite, StatutInscription, TypeDocument } from '../../api/types';

export interface Agregat {
  inscriptions: number;
  apprenants: number;
  validees: number;
  terminees: number;
  certificats: number;
  tauxCompletion: number | null;
  tauxReussite: number | null;
  satisfaction: { moyenne: number | null; reponses: number };
}

export interface Indicateurs {
  periode: { du: string; au: string };
  indicateurs: Agregat;
  comparaison: {
    periode: { du: string; au: string };
    tauxReussitePoints: number | null;
    tauxCompletionPoints: number | null;
    inscriptionsPourcent: number | null;
  };
  parMois: { mois: string; inscriptions: number; apprenants: number }[];
  parTrimestre: {
    trimestre: string;
    inscriptions: number;
    apprenants: number;
    previsionnel: boolean;
  }[];
  parFormation: (Agregat & { formation: { id: string; intitule: string }; part: number | null })[];
}

export interface FiltresIndicateurs {
  du: string;
  au: string;
  formationId?: string;
  entrepriseId?: string;
}

export interface TableauAdministration {
  comptesActifs: number;
  connexions: {
    total: number;
    variation: number | null;
    parJour: { jour: string; connexions: number }[];
  };
  demandesRgpd: { enAttente: number; suppressions: number };
  comptesVerrouilles: number;
  dernieresActions: {
    id: string;
    date: string;
    auteur: { prenom: string; nom: string } | null;
    action: string;
    typeObjet: string | null;
    details: string | null;
  }[];
}

export interface TableauFormateur {
  sessionsAVenir: number;
  apprenantsSuivis: number;
  acquisitionMoyenne: number | null;
  parSession: {
    sessionId: string;
    intitule: string;
    dateDebut: string;
    dateFin: string;
    apprenants: number;
    partValidee: number | null;
  }[];
}

export type EtatSession = 'A_VENIR' | 'EN_COURS' | 'TERMINEE';

export interface TableauApprenant {
  formationsSuivies: number;
  competences: { acquises: number; total: number };
  documents: { total: number; certificats: number; attestations: number };
  progression: {
    inscriptionId: string;
    formation: string;
    statut: StatutInscription;
    etat: EtatSession;
    competencesAcquises: number;
    competencesVisees: number;
    document: TypeDocument | null;
  }[];
  prochainesSessions: {
    inscriptionId: string;
    formation: string;
    dateDebut: string;
    dateFin: string;
    modalite: Modalite;
    lieu: string | null;
  }[];
  satisfactionAttendue: { inscriptionId: string; formation: string }[];
  consentementSatisfaction: boolean;
}

export interface LigneSalarie {
  inscriptionId: string;
  apprenant: { id: string; nom: string; prenom: string };
  formation: { id: string; intitule: string };
  session: { dateDebut: string; dateFin: string };
  statut: StatutInscription;
  etat: EtatSession;
  competencesAcquises: number;
  competencesVisees: number;
  documents: TypeDocument[];
}

export interface PageSalaries {
  donnees: LigneSalarie[];
  total: number;
  page: number;
  limit: number;
  salaries: number;
}

export interface ReponseSatisfaction {
  score: number;
  commentaire?: string;
  consentement: boolean;
}

export const clesTableaux = {
  indicateurs: (f: FiltresIndicateurs) => ['indicateurs', f] as const,
  administration: ['tableau-administration'] as const,
  formateur: ['tableau-formateur'] as const,
  apprenant: ['tableau-apprenant'] as const,
  salaries: (p: Parametres) => ['salaries', p] as const,
};

export const reportingApi = {
  indicateurs: (f: FiltresIndicateurs) => api.get<Indicateurs>('/reporting/indicateurs', { ...f }),
  administration: () => api.get<TableauAdministration>('/reporting/administration'),
  formateur: () => api.get<TableauFormateur>('/reporting/formateur'),
  apprenant: () => api.get<TableauApprenant>('/reporting/apprenant'),
  salaries: (p: Parametres) => api.get<PageSalaries>('/reporting/salaries', p),
  repondreSatisfaction: (inscriptionId: string, r: ReponseSatisfaction) =>
    api.post<{ id: string; score: number }>(`/inscriptions/${inscriptionId}/satisfaction`, r),
};
