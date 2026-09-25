import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Chiffrement symétrique authentifié AES-256-GCM des secrets stockés en base (secret TOTP).
 * OWASP A02 : la clé (MFA_ENCRYPTION_KEY) est hors base et hors code ; une fuite de la base seule
 * ne permet pas de générer les codes MFA des utilisateurs.
 *
 * Format stocké : v1.<iv base64url>.<tag base64url>.<chiffré base64url>
 */
const ALGORITHME = 'aes-256-gcm';
const VERSION = 'v1';

export function chiffrer(clair: string, cleHex: string): string {
  const iv = randomBytes(12);
  const chiffreur = createCipheriv(ALGORITHME, Buffer.from(cleHex, 'hex'), iv);
  const chiffre = Buffer.concat([chiffreur.update(clair, 'utf8'), chiffreur.final()]);
  const tag = chiffreur.getAuthTag();
  return [VERSION, iv, tag, chiffre]
    .map((p) => (typeof p === 'string' ? p : p.toString('base64url')))
    .join('.');
}

export function dechiffrer(valeur: string, cleHex: string): string {
  const [version, iv, tag, chiffre] = valeur.split('.');
  if (version !== VERSION || !iv || !tag || !chiffre) {
    throw new Error('Format de donnée chiffrée inconnu');
  }
  const dechiffreur = createDecipheriv(
    ALGORITHME,
    Buffer.from(cleHex, 'hex'),
    Buffer.from(iv, 'base64url'),
  );
  dechiffreur.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    dechiffreur.update(Buffer.from(chiffre, 'base64url')),
    dechiffreur.final(),
  ]).toString('utf8');
}
