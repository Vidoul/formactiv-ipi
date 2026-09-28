import { api } from '../../api/client';
import type { StatutInscription, TypeReferentiel } from '../../api/types';

export interface CelluleNote {
  evaluationId: string;
  note: number;
  acquise: boolean;
}

export interface FeuilleEvaluation {
  session: {
    id: string;
    dateDebut: string;
    dateFin: string;
    formation: { id: string; intitule: string; seuilAcquisition: number };
  };
  competences: { id: string; libelle: string; typeReferentiel: TypeReferentiel }[];
  lignes: {
    inscriptionId: string;
    statut: StatutInscription;
    apprenant: { id: string; nom: string; prenom: string };
    notes: Record<string, CelluleNote | null>;
    acquises: number;
    total: number;
  }[];
  modifiable: boolean;
}

export interface NoteSaisie {
  inscriptionId: string;
  competenceId: string;
  note: number;
}

export const evaluationsApi = {
  feuille: (sessionId: string) =>
    api.get<FeuilleEvaluation>(`/sessions/${sessionId}/feuille-evaluation`),
  enregistrer: (sessionId: string, notes: NoteSaisie[]) =>
    api.put<FeuilleEvaluation>(`/sessions/${sessionId}/feuille-evaluation`, { notes }),
};

/** Interprète une saisie (virgule ou point décimal) ; null si vide, NaN si invalide. */
export function lireNote(saisie: string): number | null {
  const texte = saisie.trim().replace(',', '.');
  if (texte === '') return null;
  return /^\d{1,2}(\.\d{1,2})?$/.test(texte) ? Number(texte) : Number.NaN;
}

export function noteValide(note: number | null): boolean {
  return note === null || (Number.isFinite(note) && note >= 0 && note <= 20);
}
