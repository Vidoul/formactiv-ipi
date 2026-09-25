import * as argon2 from 'argon2';

/**
 * Hachage des mots de passe (REQ-SEC-001, chapitre 10) : Argon2id avec les paramètres minimaux
 * recommandés par l'OWASP Password Storage Cheat Sheet (m = 19 MiB, t = 2, p = 1).
 * Le sel est généré aléatoirement par la bibliothèque et intégré au hash.
 */
const OPTIONS_ARGON2 = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hacherMotDePasse(motDePasse: string): Promise<string> {
  return argon2.hash(motDePasse, OPTIONS_ARGON2);
}

export async function verifierMotDePasse(hash: string, motDePasse: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, motDePasse);
  } catch {
    return false;
  }
}

/**
 * Hash factice calculé une fois : utilisé lorsque l'email est inconnu pour que la durée de
 * réponse ne révèle pas l'existence du compte (anti-énumération, UC-01 A1).
 */
let hashLeurre: Promise<string> | undefined;
export function obtenirHashLeurre(): Promise<string> {
  hashLeurre ??= hacherMotDePasse('leurre-anti-enumeration-formactiv');
  return hashLeurre;
}
