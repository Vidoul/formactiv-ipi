/**
 * Dates calendaires (sessions : colonnes DATE sans heure). Les dates métier sont manipulées au
 * format ISO « AAAA-MM-JJ » ; « aujourd'hui » est évalué dans le fuseau de FORMACTIV
 * (Europe/Paris) et non en UTC, pour éviter un décalage entre minuit et 2 h du matin.
 */
const FORMAT_ISO_PARIS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Date du jour à Paris, « AAAA-MM-JJ ». */
export function aujourdhui(maintenant: Date = new Date()): string {
  return FORMAT_ISO_PARIS.format(maintenant);
}

/** Convertit une date calendaire Prisma (minuit UTC) en « AAAA-MM-JJ ». */
export function versIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Convertit « AAAA-MM-JJ » en Date à minuit UTC (stockage des colonnes DATE). */
export function depuisIso(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Décale une date ISO de n jours. */
export function ajouterJours(iso: string, jours: number): string {
  const d = depuisIso(iso);
  d.setUTCDate(d.getUTCDate() + jours);
  return versIso(d);
}

/** « 15/09 » : jour et mois d'une date ISO (libellés courts des maquettes). */
export function jourMois(iso: string): string {
  const [, mois, jour] = iso.split('-');
  return `${jour}/${mois}`;
}
