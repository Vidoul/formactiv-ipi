/**
 * Variables d'environnement des tests d'intégration. Aucune ne correspond à un secret réel.
 * La base de test est dédiée (vidée entre les suites) : ne jamais pointer vers une base de DEV.
 */
import os from 'node:os';
import path from 'node:path';

export const URL_BASE_TEST =
  process.env.DATABASE_URL_TEST ??
  'postgresql://formactiv:formactiv@localhost:5433/formactiv_test?schema=public';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: URL_BASE_TEST,
  WEB_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173',
  JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdefghijklmnop',
  JWT_ACCESS_TTL_SECONDES: '900',
  JWT_MFA_SECRET: 'test-mfa-secret-0123456789abcdefghijklmnopqrs',
  REFRESH_TOKEN_TTL_JOURS: '7',
  COOKIE_SECURE: 'false',
  MFA_ENCRYPTION_KEY: '1f'.repeat(32),
  DOCUMENT_URL_SECRET: 'test-document-secret-0123456789abcdefghijk',
  DOCUMENT_URL_TTL_SECONDES: '300',
  MAIL_TRANSPORT: 'memoire',
  MAIL_FROM: 'FORMACTIV <no-reply@formactiv.test>',
  STORAGE_DRIVER: 'local',
  STORAGE_LOCAL_DIR: path.join(os.tmpdir(), 'formactiv-tests-storage'),
  PASSWORD_PWNED_CHECK: 'false',
  SWAGGER_ENABLED: 'false',
  THROTTLE_LIMITE_GLOBALE: '10000',
  THROTTLE_LIMITE_AUTH: '10000',
});
