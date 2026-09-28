import { StatutInscription } from '@prisma/client';
import { ajouterJours, depuisIso } from '../../common/utils/dates';

/**
 * Indicateurs de pilotage (RG-DASH-01) — fonctions pures.
 *
 * Définitions proposées par l'équipe, à faire valider (le sujet nomme les indicateurs sans les
 * définir) :
 * - taux de réussite = certificats obtenus ÷ inscriptions terminées, un certificat étant obtenu
 *   lorsque toutes les compétences visées sont acquises (conditions RG-CERT-01) ;
 * - taux de complétion = inscriptions terminées ÷ inscriptions validées (une inscription terminée
 *   a nécessairement été validée : elle compte au dénominateur) ;
 * - satisfaction = moyenne des réponses aux questionnaires (1 à 5, RG-DASH-04).
 */

export interface LigneIndicateur {
  apprenantId: string;
  statut: StatutInscription;
  formationId: string;
  intitule: string;
  /** Début de la session, « AAAA-MM-JJ » : rattache l'inscription à une période. */
  dateDebut: string;
  competencesVisees: number;
  competencesAcquises: number;
  /** Score de satisfaction (1..5) ou null sans réponse. */
  score: number | null;
}

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

/** Ratio arrondi au millième, null si le dénominateur est nul (indicateur non calculable). */
export function ratio(numerateur: number, denominateur: number): number | null {
  if (denominateur <= 0) return null;
  return Math.round((numerateur / denominateur) * 1000) / 1000;
}

/** Certificat obtenu : inscription terminée et toutes les compétences visées acquises. */
export function certificatObtenu(
  l: Pick<LigneIndicateur, 'statut' | 'competencesVisees' | 'competencesAcquises'>,
): boolean {
  return (
    l.statut === StatutInscription.TERMINEE &&
    l.competencesVisees > 0 &&
    l.competencesAcquises >= l.competencesVisees
  );
}

export function agreger(lignes: LigneIndicateur[]): Agregat {
  const actives = lignes.filter((l) => l.statut !== StatutInscription.ANNULEE);
  const terminees = lignes.filter((l) => l.statut === StatutInscription.TERMINEE);
  const validees = lignes.filter(
    (l) => l.statut === StatutInscription.VALIDEE || l.statut === StatutInscription.TERMINEE,
  ).length;
  const certificats = terminees.filter(certificatObtenu).length;
  const scores = lignes.flatMap((l) => (l.score === null ? [] : [l.score]));
  return {
    inscriptions: actives.length,
    apprenants: new Set(actives.map((l) => l.apprenantId)).size,
    validees,
    terminees: terminees.length,
    certificats,
    tauxCompletion: ratio(terminees.length, validees),
    tauxReussite: ratio(certificats, terminees.length),
    satisfaction: {
      moyenne:
        scores.length === 0
          ? null
          : Math.round((scores.reduce((s, n) => s + n, 0) / scores.length) * 10) / 10,
      reponses: scores.length,
    },
  };
}

export interface Periode {
  du: string;
  au: string;
}

/** Période de même durée précédant immédiatement la période donnée (comparaisons). */
export function periodePrecedente(p: Periode): Periode {
  const jours =
    Math.round((depuisIso(p.au).getTime() - depuisIso(p.du).getTime()) / 86_400_000) + 1;
  return { du: ajouterJours(p.du, -jours), au: ajouterJours(p.du, -1) };
}

/** Mois « AAAA-MM » couverts par la période, dans l'ordre. */
export function moisDeLaPeriode(p: Periode): string[] {
  const mois: string[] = [];
  let [annee, m] = p.du.slice(0, 7).split('-').map(Number);
  const [anneeFin, moisFin] = p.au.slice(0, 7).split('-').map(Number);
  while (annee < anneeFin || (annee === anneeFin && m <= moisFin)) {
    mois.push(`${annee}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      annee += 1;
    }
    if (mois.length > 36) break;
  }
  return mois;
}

/** Variation relative en pourcentage entier (null si la base est nulle). */
export function variation(actuel: number, precedent: number): number | null {
  if (precedent <= 0) return null;
  return Math.round(((actuel - precedent) / precedent) * 100);
}

/** Écart en points de pourcentage entre deux taux (null si l'un manque). */
export function ecartPoints(actuel: number | null, precedent: number | null): number | null {
  if (actuel === null || precedent === null) return null;
  return Math.round((actuel - precedent) * 100);
}

/** Année civile en cours (période par défaut). */
export function anneeCivile(jour: string): Periode {
  const annee = jour.slice(0, 4);
  return { du: `${annee}-01-01`, au: `${annee}-12-31` };
}
