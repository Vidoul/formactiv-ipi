/**
 * RG-AUTH-01 — Politique de mot de passe « fort » (inspirée des recommandations CNIL / ANSSI) :
 * 12 caractères minimum mêlant majuscules, minuscules, chiffres et caractères spéciaux, et
 * vérification contre une liste de mots de passe compromis ou trop prévisibles.
 */
export const LONGUEUR_MIN = 12;
/** Borne haute : évite un déni de service par hachage de chaînes géantes. */
export const LONGUEUR_MAX = 128;

/**
 * Racines de mots de passe parmi les plus fréquentes dans les fuites publiques (dont des
 * variantes françaises). Un mot de passe est refusé si, une fois débarrassé de ses chiffres et
 * caractères spéciaux en début/fin, il se réduit à l'une de ces racines (« Azerty123456! »).
 */
const RACINES_COMPROMISES = new Set([
  'password',
  'passw0rd',
  'motdepasse',
  'azerty',
  'azertyuiop',
  'qwerty',
  'qwertyuiop',
  'bonjour',
  'soleil',
  'admin',
  'administrateur',
  'administrator',
  'welcome',
  'bienvenue',
  'changeme',
  'letmein',
  'iloveyou',
  'jetaime',
  'marseille',
  'toulouse',
  'paris',
  'montpellier',
  'football',
  'dragon',
  'monkey',
  'master',
  'sunshine',
  'princess',
  'loulou',
  'chouchou',
  'doudou',
  'superman',
  'batman',
  'starwars',
  'pokemon',
  'formactiv',
  'formation',
  'apprenant',
  'formateur',
  'utilisateur',
  'secret',
  'login',
  'test',
  'default',
  'abcdef',
  'abc',
]);

export type ErreurPolitique =
  | 'TROP_COURT'
  | 'TROP_LONG'
  | 'MAJUSCULE_MANQUANTE'
  | 'MINUSCULE_MANQUANTE'
  | 'CHIFFRE_MANQUANT'
  | 'SPECIAL_MANQUANT'
  | 'TROP_PREVISIBLE'
  | 'CONTIENT_IDENTITE';

export const MESSAGES_POLITIQUE: Record<ErreurPolitique, string> = {
  TROP_COURT: `Le mot de passe doit contenir au moins ${LONGUEUR_MIN} caractères.`,
  TROP_LONG: `Le mot de passe ne doit pas dépasser ${LONGUEUR_MAX} caractères.`,
  MAJUSCULE_MANQUANTE: 'Le mot de passe doit contenir au moins une majuscule.',
  MINUSCULE_MANQUANTE: 'Le mot de passe doit contenir au moins une minuscule.',
  CHIFFRE_MANQUANT: 'Le mot de passe doit contenir au moins un chiffre.',
  SPECIAL_MANQUANT: 'Le mot de passe doit contenir au moins un caractère spécial.',
  TROP_PREVISIBLE:
    'Ce mot de passe est trop courant ou figure dans des listes de mots de passe compromis.',
  CONTIENT_IDENTITE: 'Le mot de passe ne doit pas contenir votre nom, prénom ou adresse email.',
};

export interface IdentiteUtilisateur {
  nom?: string;
  prenom?: string;
  email?: string;
}

function normaliser(texte: string): string {
  return texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

function estSequenceTriviale(texte: string): boolean {
  if (/^(.)\1+$/.test(texte)) return true; // « aaaaaaaa »
  const suites = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'azertyuiop', 'qwertyuiop'];
  return texte.length >= 6 && suites.some((s) => s.includes(texte));
}

/** Retourne la liste des règles non respectées (vide si le mot de passe est conforme). */
export function verifierPolitique(
  motDePasse: string,
  identite: IdentiteUtilisateur = {},
): ErreurPolitique[] {
  const erreurs: ErreurPolitique[] = [];
  if (motDePasse.length < LONGUEUR_MIN) erreurs.push('TROP_COURT');
  if (motDePasse.length > LONGUEUR_MAX) erreurs.push('TROP_LONG');
  if (!/\p{Lu}/u.test(motDePasse)) erreurs.push('MAJUSCULE_MANQUANTE');
  if (!/\p{Ll}/u.test(motDePasse)) erreurs.push('MINUSCULE_MANQUANTE');
  if (!/\d/.test(motDePasse)) erreurs.push('CHIFFRE_MANQUANT');
  if (!/[^\p{L}\d]/u.test(motDePasse)) erreurs.push('SPECIAL_MANQUANT');

  const racine = normaliser(motDePasse).replace(/^[^a-z]+|[^a-z]+$/g, '');
  if (RACINES_COMPROMISES.has(racine) || estSequenceTriviale(racine)) {
    erreurs.push('TROP_PREVISIBLE');
  }

  const clair = normaliser(motDePasse);
  const fragments = [identite.nom, identite.prenom, identite.email?.split('@')[0]]
    .filter((f): f is string => !!f && f.length >= 3)
    .map(normaliser);
  if (fragments.some((f) => clair.includes(f))) erreurs.push('CONTIENT_IDENTITE');

  return erreurs;
}
