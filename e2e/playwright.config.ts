import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { ENV_API, PORT_API, PORT_WEB, RACINE, URL_WEB } from './environnement';

const CI = Boolean(process.env.CI);

/**
 * Tests de bout en bout : l'API compilée et le front de production (vite preview, proxy /api)
 * sont démarrés sur des ports dédiés, face à une base réinitialisée (preparer-base.ts).
 * En local, le navigateur Chrome installé est utilisé ; en CI, Chromium de Playwright.
 */
export default defineConfig({
  testDir: './tests',
  // Les scénarios partagent la base de démonstration : exécution séquentielle.
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: URL_WEB,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'bureau',
      use: { ...devices['Desktop Chrome'], channel: CI ? undefined : 'chrome' },
    },
    {
      // Affichage mobile (RGAA 10.11, reflow) : audit d'accessibilité des écrans principaux.
      name: 'mobile',
      testMatch: /accessibilite\.spec\.ts/,
      use: { ...devices['Pixel 7'], channel: CI ? undefined : 'chrome' },
    },
  ],
  webServer: [
    {
      command: 'npm run build && node dist/main.js',
      cwd: path.join(RACINE, 'apps', 'api'),
      url: `http://localhost:${PORT_API}/api/v1/sante`,
      env: ENV_API,
      reuseExistingServer: !CI,
      timeout: 180_000,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `npx vite build && npx vite preview --port ${PORT_WEB} --strictPort`,
      cwd: path.join(RACINE, 'apps', 'web'),
      url: URL_WEB,
      env: { VITE_API_PROXY: `http://localhost:${PORT_API}` },
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
});
