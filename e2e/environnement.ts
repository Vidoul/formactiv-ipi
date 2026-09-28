import path from 'node:path';

/**
 * Environnement des tests de bout en bout. Base dédiée, remise à zéro à chaque exécution :
 * ne jamais la faire pointer vers une base de développement ou de production.
 */
export const URL_BASE_E2E =
  process.env.DATABASE_URL_E2E ??
  'postgresql://formactiv:formactiv@localhost:5433/formactiv_e2e?schema=public';

export const PORT_API = 3100;
export const PORT_WEB = 4173;
export const URL_WEB = `http://localhost:${PORT_WEB}`;

/** Dossier de stockage des PDF propre aux tests (seed et génération). */
export const STOCKAGE_E2E = path.join(__dirname, '.stockage-e2e');

export const RACINE = path.resolve(__dirname, '..');

/** Mot de passe des comptes de démonstration (prisma/seed.ts). */
export const MOT_DE_PASSE_DEMO = 'Demo#Formactiv2026';

/**
 * Variables de l'API démarrée pour les tests : NODE_ENV=test (aucun fichier .env lu), secrets
 * factices, emails conservés en mémoire, limitation de débit relâchée.
 */
export const ENV_API: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: String(PORT_API),
  DATABASE_URL: URL_BASE_E2E,
  WEB_URL: URL_WEB,
  CORS_ORIGINS: URL_WEB,
  JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789abcdefghijklmn',
  JWT_ACCESS_TTL_SECONDES: '900',
  JWT_MFA_SECRET: 'e2e-mfa-secret-0123456789abcdefghijklmnopq',
  REFRESH_TOKEN_TTL_JOURS: '7',
  COOKIE_SECURE: 'false',
  MFA_ENCRYPTION_KEY: '2e'.repeat(32),
  DOCUMENT_URL_SECRET: 'e2e-document-secret-0123456789abcdefghij',
  DOCUMENT_URL_TTL_SECONDES: '300',
  MAIL_TRANSPORT: 'memoire',
  MAIL_FROM: 'FORMACTIV <no-reply@formactiv.test>',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: STOCKAGE_E2E,
  PASSWORD_PWNED_CHECK: 'false',
  SWAGGER_ENABLED: 'false',
  THROTTLE_LIMITE_GLOBALE: '10000',
  THROTTLE_LIMITE_AUTH: '10000',
};
