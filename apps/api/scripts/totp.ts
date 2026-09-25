/**
 * Outil de DÉVELOPPEMENT : affiche le code TOTP courant d'un secret base32, pour tester la double
 * authentification sans application mobile.
 *
 *   npm run totp -w apps/api -- JBSWY3DPEHPK3PXP
 */
import { authenticator } from 'otplib';

const secret = process.argv[2];
if (!secret || !/^[A-Z2-7]+=*$/i.test(secret)) {
  console.error('Usage : npm run totp -w apps/api -- <SECRET_BASE32>');
  process.exit(1);
}
const restant = 30 - (Math.floor(Date.now() / 1000) % 30);
console.log(`Code : ${authenticator.generate(secret.toUpperCase())} (valable encore ${restant} s)`);
