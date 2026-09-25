import type { Config } from 'jest';

/**
 * Tests d'intégration / API (Supertest) exécutés contre une base PostgreSQL réelle :
 * enchaînements des cas d'utilisation, matrice RBAC, règles de gestion portées par la base.
 */
const config: Config = {
  rootDir: '..',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true }],
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  testTimeout: 30_000,
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.module.ts', '!src/main.ts', '!src/**/*.dto.ts'],
  coverageDirectory: 'coverage/e2e',
};

export default config;
