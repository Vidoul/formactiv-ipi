import { execSync } from 'node:child_process';
import path from 'node:path';
import { URL_BASE_TEST } from './setup-env';

/**
 * Applique les migrations versionnées sur la base de test avant l'exécution des suites :
 * les tests valident donc aussi le schéma réellement déployé (contraintes CHECK, trigger).
 */
export default function globalSetup(): void {
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: URL_BASE_TEST },
    stdio: 'inherit',
  });
}
