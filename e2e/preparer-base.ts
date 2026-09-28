/**
 * Prépare la base des tests de bout en bout : schéma recréé, migrations appliquées, jeu de
 * démonstration chargé (personas des maquettes Figma). Exécuté avant `playwright test`.
 *
 * Garde-fou : seule une base dont le nom se termine par « _e2e » peut être réinitialisée.
 */
import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { RACINE, STOCKAGE_E2E, URL_BASE_E2E } from './environnement';

async function preparer(): Promise<void> {
  const nomBase = new URL(URL_BASE_E2E).pathname.replace(/^\//, '');
  if (!nomBase.endsWith('_e2e')) {
    throw new Error(`Refus : « ${nomBase} » n'est pas une base de tests de bout en bout (*_e2e).`);
  }

  const prisma = new PrismaClient({ datasourceUrl: URL_BASE_E2E });
  try {
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await prisma.$executeRawUnsafe('CREATE SCHEMA public');
  } finally {
    await prisma.$disconnect();
  }
  rmSync(STOCKAGE_E2E, { recursive: true, force: true });

  const env = {
    ...process.env,
    DATABASE_URL: URL_BASE_E2E,
    SEED_MODE: 'demo',
    STORAGE_DRIVER: 'local',
    STORAGE_LOCAL_DIR: STOCKAGE_E2E,
  };
  const api = path.join(RACINE, 'apps', 'api');
  execSync('npx prisma migrate deploy', { cwd: api, env, stdio: 'inherit' });
  execSync('npx tsx prisma/seed.ts', { cwd: api, env, stdio: 'inherit' });
}

preparer().catch((erreur: unknown) => {
  console.error(erreur);
  process.exitCode = 1;
});
