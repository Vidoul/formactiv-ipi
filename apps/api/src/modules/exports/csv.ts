/**
 * Écriture CSV pour tableurs francophones (Excel, LibreOffice) :
 * - séparateur « ; », fins de ligne CRLF, encodage UTF-8 avec BOM ;
 * - guillemets doublés et champ entouré de guillemets si nécessaire (RFC 4180) ;
 * - neutralisation de l'injection de formules (OWASP « CSV Injection ») : une cellule commençant
 *   par =, +, -, @, tabulation ou retour chariot est préfixée d'une apostrophe.
 */
export const SEPARATEUR = ';';
const BOM = '\uFEFF';
const DEBUT_FORMULE = /^[=+\-@\t\r]/;

export type Cellule = string | number | boolean | null | undefined;

export function celluleCsv(valeur: Cellule): string {
  if (valeur === null || valeur === undefined) return '';
  let texte = typeof valeur === 'boolean' ? (valeur ? 'Oui' : 'Non') : String(valeur);
  if (typeof valeur === 'number') texte = texte.replace('.', ',');
  else if (DEBUT_FORMULE.test(texte)) texte = `'${texte}`;
  return /[";\r\n]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

export function genererCsv(entetes: string[], lignes: Cellule[][]): Buffer {
  const contenu = [entetes, ...lignes]
    .map((ligne) => ligne.map((c) => celluleCsv(c)).join(SEPARATEUR))
    .join('\r\n');
  return Buffer.from(`${BOM}${contenu}\r\n`, 'utf8');
}
