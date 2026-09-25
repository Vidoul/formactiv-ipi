import type { Config } from 'jest';

/**
 * Tests unitaires : règles de gestion (fonctions pures *.rules.ts), services avec dépendances
 * simulées, gardes et utilitaires. Aucun accès base de données.
 *
 * `isolatedModules` : transpilation seule (rapide) — le typage est vérifié par `npm run typecheck`.
 */
const config: Config = {
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.json', isolatedModules: true }],
  },
  testEnvironment: 'node',
  collectCoverageFrom: ['**/*.ts', '!**/*.module.ts', '!main.ts', '!**/*.dto.ts'],
  coverageDirectory: '../coverage/unit',
};

export default config;
