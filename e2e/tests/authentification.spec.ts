import { expect, test } from '@playwright/test';
import { COMPTES, seConnecter } from '../utils/session';

test.describe('Authentification et contrôle d’accès (UC-01, RG-AUTH, matrice RBAC)', () => {
  test('redirige un visiteur non connecté vers la connexion', async ({ page }) => {
    await page.goto('/mon-espace');
    await expect(page).toHaveURL(/\/connexion/);
    await expect(page.getByRole('heading', { name: 'FORMACTIV' })).toBeVisible();
  });

  test('refuse un mot de passe erroné sans révéler l’existence du compte', async ({ page }) => {
    await page.goto('/connexion');
    await page.getByLabel(/^Adresse email/).fill(COMPTES.apprenante);
    await page.getByLabel(/^Mot de passe/).fill('Mauvais#MotDePasse1');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toHaveText(/Adresse email ou mot de passe incorrect\./);
    await expect(page).toHaveURL(/\/connexion/);
  });

  test('ouvre l’espace du rôle et refuse l’espace d’un autre rôle', async ({ page }) => {
    await seConnecter(page, COMPTES.apprenante);
    await expect(page).toHaveURL(/\/mon-espace/);
    await expect(page.getByRole('heading', { name: 'Bonjour Léa' })).toBeVisible();

    await page.goto('/pilotage');
    await expect(page.getByRole('heading', { name: 'Accès refusé' })).toBeVisible();
  });

  test('restaure la session au rechargement puis se déconnecte', async ({ page }) => {
    await seConnecter(page, COMPTES.formateur);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page).not.toHaveURL(/\/connexion/);

    await page.getByRole('button', { name: 'Déconnexion' }).click();
    await expect(page).toHaveURL(/\/connexion/);
    await page.goto('/formateur/sessions');
    await expect(page).toHaveURL(/\/connexion/);
  });
});
