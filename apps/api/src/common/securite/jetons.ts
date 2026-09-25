import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Jeton opaque aléatoire (256 bits) transmis à l'utilisateur (cookie, lien email). */
export function genererJeton(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Empreinte SHA-256 d'un jeton : seule l'empreinte est stockée en base, de sorte qu'une fuite de
 * la base ne permette pas de réutiliser les refresh tokens ni les liens de réinitialisation.
 */
export function empreinte(jeton: string): string {
  return createHash('sha256').update(jeton).digest('hex');
}

/** Signature HMAC-SHA256 (URL de téléchargement signées, ADR-05). */
export function signer(message: string, secret: string): string {
  return createHmac('sha256', secret).update(message).digest('base64url');
}

/** Comparaison en temps constant (évite les attaques temporelles sur les signatures). */
export function egaliteConstante(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
