/**
 * Périodes proposées dans les filtres des tableaux de bord (RG-DASH-03). Les bornes sont des
 * dates calendaires « AAAA-MM-JJ » calculées à partir du jour courant.
 */
export type CodePeriode =
  'trimestre' | 'trimestre-precedent' | 'annee' | 'annee-precedente' | '12-mois';

export const PERIODES: { valeur: CodePeriode; libelle: string }[] = [
  { valeur: 'trimestre', libelle: 'Trimestre en cours' },
  { valeur: 'trimestre-precedent', libelle: 'Trimestre précédent' },
  { valeur: 'annee', libelle: 'Année en cours' },
  { valeur: 'annee-precedente', libelle: 'Année précédente' },
  { valeur: '12-mois', libelle: '12 derniers mois' },
];

const iso = (annee: number, mois: number, jour: number) =>
  new Date(Date.UTC(annee, mois, jour)).toISOString().slice(0, 10);

/** Bornes d'une période ; `jour` est la date du jour « AAAA-MM-JJ ». */
export function bornesPeriode(code: CodePeriode, jour: string): { du: string; au: string } {
  const [a, m] = jour.split('-').map(Number);
  const mois = m - 1;
  const debutTrimestre = mois - (mois % 3);
  switch (code) {
    case 'trimestre':
      return { du: iso(a, debutTrimestre, 1), au: iso(a, debutTrimestre + 3, 0) };
    case 'trimestre-precedent':
      return { du: iso(a, debutTrimestre - 3, 1), au: iso(a, debutTrimestre, 0) };
    case 'annee':
      return { du: `${a}-01-01`, au: `${a}-12-31` };
    case 'annee-precedente':
      return { du: `${a - 1}-01-01`, au: `${a - 1}-12-31` };
    case '12-mois':
      return { du: iso(a, mois - 11, 1), au: iso(a, mois + 1, 0) };
  }
}

const MOIS_COURTS = [
  'Janv',
  'Févr',
  'Mars',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sept',
  'Oct',
  'Nov',
  'Déc',
];
const MOIS_LONGS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** « 2026-02 » → { court: « Févr », long: « février 2026 » } (graphiques et alternatives). */
export function libelleMois(mois: string): { court: string; long: string } {
  const [a, m] = mois.split('-').map(Number);
  return { court: MOIS_COURTS[m - 1], long: `${MOIS_LONGS[m - 1]} ${a}` };
}

/** Date du jour à Paris (les indicateurs sont calculés sur le calendrier de FORMACTIV). */
export function jourParis(maintenant = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(maintenant);
}

/** « +2 pts vs période précédente », « stable vs période précédente » (écart de taux). */
export function libelleEcartPoints(points: number | null): string | undefined {
  if (points === null) return undefined;
  if (points === 0) return 'stable vs période précédente';
  return `${points > 0 ? '+' : ''}${points} pts vs période précédente`;
}

/** « +11 % vs période précédente » (variation relative). */
export function libelleVariation(pourcent: number | null): string | undefined {
  if (pourcent === null) return undefined;
  if (pourcent === 0) return 'stable vs période précédente';
  return `${pourcent > 0 ? '+' : ''}${pourcent} % vs période précédente`;
}

export function tonalite(valeur: number | null): 'positive' | 'negative' | 'neutre' {
  if (valeur === null || valeur === 0) return 'neutre';
  return valeur > 0 ? 'positive' : 'negative';
}
