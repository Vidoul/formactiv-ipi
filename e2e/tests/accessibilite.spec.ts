import { expect, test, type Page } from '@playwright/test';
import { auditerAccessibilite } from '../utils/accessibilite';
import { COMPTES, seConnecter, seConnecterAvecMfa } from '../utils/session';

/**
 * Audit d'accessibilité automatisé (axe-core, WCAG 2.1 A/AA) des écrans des maquettes, pour
 * chaque profil, en affichage bureau et mobile (projets Playwright « bureau » et « mobile »).
 */
async function auditer(page: Page, chemins: string[]): Promise<void> {
  for (const chemin of chemins) {
    await page.goto(chemin);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Chargement en cours…')).toHaveCount(0);
    await auditerAccessibilite(page, chemin);
  }
}

test('pages publiques', async ({ page }) => {
  await auditer(page, [
    '/connexion',
    '/mot-de-passe-oublie',
    '/aide',
    '/accessibilite',
    '/confidentialite',
    '/page-inexistante',
  ]);
});

test('espace apprenant', async ({ page }) => {
  await seConnecter(page, COMPTES.apprenante);
  await auditer(page, [
    '/mon-espace',
    '/mon-parcours',
    '/mes-documents',
    '/rgpd/mes-donnees',
    '/mon-compte/securite',
  ]);
});

test('espace formateur', async ({ page }) => {
  await seConnecter(page, COMPTES.formateur);
  await auditer(page, [
    '/formateur/sessions',
    '/formateur/evaluations',
    '/formateur/tableau-de-bord',
  ]);
});

test('espace client entreprise', async ({ page }) => {
  await seConnecter(page, COMPTES.client);
  await auditer(page, [
    '/entreprise/tableau-de-bord',
    '/entreprise/salaries',
    '/entreprise/exports',
  ]);
});

test('espace responsable formation', async ({ page }) => {
  await seConnecterAvecMfa(page, COMPTES.responsable);
  await auditer(page, [
    '/pilotage',
    '/formations',
    '/competences',
    '/sessions',
    '/sessions/nouvelle',
    '/inscriptions',
    '/documents',
    '/exports',
  ]);
});

test('espace administrateur', async ({ page }) => {
  await seConnecterAvecMfa(page, COMPTES.admin);
  await auditer(page, [
    '/admin/tableau-de-bord',
    '/admin/utilisateurs',
    '/admin/entreprises',
    '/admin/rgpd',
    '/admin/journal',
    '/admin/parametres',
  ]);
});
