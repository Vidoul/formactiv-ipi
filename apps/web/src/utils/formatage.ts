/** Formatage des valeurs pour l'affichage (locale fr-FR). */

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

const FORMAT_DATE_HEURE = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const FORMAT_MOIS_ANNEE = new Intl.DateTimeFormat('fr-FR', {
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Date calendaire (« 2026-09-14 » ou ISO) → « 14/09/2026 ». */
export function formaterDate(valeur: string | null | undefined): string {
  if (!valeur) return '—';
  return FORMAT_DATE.format(new Date(valeur));
}

/** Instant ISO → « 27/07/2026 18:42 » (heure locale du navigateur). */
export function formaterDateHeure(valeur: string | null | undefined): string {
  if (!valeur) return '—';
  return FORMAT_DATE_HEURE.format(new Date(valeur)).replace(',', '');
}

/** « 09/2026 » : période d'une session dans l'historique de parcours. */
export function formaterMoisAnnee(valeur: string): string {
  return FORMAT_MOIS_ANNEE.format(new Date(valeur));
}

/** Plage de dates d'une session : « 14 au 18/09/2026 » (maquettes Figma). */
export function formaterPlageDates(debut: string, fin: string): string {
  const d = new Date(debut);
  const f = new Date(fin);
  if (d.getTime() === f.getTime()) return formaterDate(debut);
  const memeMois = d.getUTCMonth() === f.getUTCMonth() && d.getUTCFullYear() === f.getUTCFullYear();
  const jourDebut = String(d.getUTCDate()).padStart(2, '0');
  if (memeMois) return `${jourDebut} au ${formaterDate(fin)}`;
  const debutCourt = FORMAT_DATE.format(d).slice(0, 5);
  return `${debutCourt} au ${formaterDate(fin)}`;
}

/** Note décimale → « 12,5 » (une décimale au plus). */
export function formaterNote(note: number | null | undefined): string {
  if (note === null || note === undefined) return '—';
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(note);
}

/** Satisfaction moyenne → « 4,2 / 5 » (« — » sans réponse, RG-DASH-04). */
export function formaterSatisfaction(moyenne: number | null | undefined): string {
  if (moyenne === null || moyenne === undefined) return '—';
  return `${formaterNote(moyenne)} / 5`;
}

/** Ratio [0..1] → « 87 % ». */
export function formaterPourcentage(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '—';
  return `${Math.round(ratio * 100)} %`;
}

export function formaterNombre(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n);
}

export function initiales(prenom: string, nom: string): string {
  return `${prenom.charAt(0)}${nom.charAt(0)}`.toUpperCase();
}

/** Date du jour au format AAAA-MM-JJ (valeur des champs <input type="date">). */
export function aujourdhuiIso(): string {
  return new Date().toISOString().slice(0, 10);
}
