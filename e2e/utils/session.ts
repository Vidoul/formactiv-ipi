import { expect, type Page } from '@playwright/test';
import { authenticator } from 'otplib';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { MOT_DE_PASSE_DEMO, STOCKAGE_E2E } from '../environnement';

/** Comptes de démonstration (prisma/seed.ts, personas des maquettes Figma). */
export const COMPTES = {
  admin: 'a.dupre@formactiv.fr',
  responsable: 'nadia.rey@formactiv.fr',
  formateur: 'k.selle@formactiv.fr',
  apprenante: 'lea.martin@mail.fr',
  client: 't.morel@oxalys.fr',
} as const;

/**
 * Secrets TOTP des comptes enrôlés pendant l'exécution, partagés entre fichiers de tests (même
 * exécution, base réinitialisée à chaque lancement). Le dernier pas de temps utilisé est mémorisé :
 * l'API refuse le rejeu d'un code déjà accepté.
 */
const FICHIER_MFA = path.join(STOCKAGE_E2E, 'mfa-e2e.json');

interface EtatMfa {
  secret: string;
  dernierPas: number;
}

function lireEtats(): Record<string, EtatMfa> {
  return existsSync(FICHIER_MFA)
    ? (JSON.parse(readFileSync(FICHIER_MFA, 'utf8')) as Record<string, EtatMfa>)
    : {};
}

function ecrireEtat(email: string, etat: EtatMfa): void {
  mkdirSync(STOCKAGE_E2E, { recursive: true });
  writeFileSync(FICHIER_MFA, JSON.stringify({ ...lireEtats(), [email]: etat }));
}

const pasCourant = () => Math.floor(Date.now() / 30_000);

/** Code TOTP d'un pas de temps encore jamais utilisé pour ce compte (attend au besoin). */
async function codeFrais(email: string, secret: string): Promise<string> {
  const precedent = lireEtats()[email]?.dernierPas ?? -1;
  while (pasCourant() <= precedent) {
    await new Promise((r) => setTimeout(r, 1_000));
  }
  // Marge : pas de code émis dans la dernière seconde d'un pas de 30 s.
  if (Date.now() % 30_000 > 29_000) await new Promise((r) => setTimeout(r, 1_200));
  ecrireEtat(email, { secret, dernierPas: pasCourant() });
  return authenticator.generate(secret);
}

/** Connexion par le formulaire (écran Figma 01). */
export async function seConnecter(
  page: Page,
  email: string,
  motDePasse = MOT_DE_PASSE_DEMO,
): Promise<void> {
  await page.goto('/connexion');
  await page.getByLabel(/^Adresse email/).fill(email);
  await page.getByLabel(/^Mot de passe/).fill(motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // Fin de la connexion : ouverture de l'espace ou demande du code (MFA activée).
  await Promise.race([
    page.waitForURL((url) => !url.pathname.startsWith('/connexion')),
    page.getByLabel(/Code de vérification/).waitFor(),
  ]);
}

/**
 * Connexion d'un compte soumis à la MFA obligatoire (RG-AUTH-03) : enrôlement au premier accès
 * (clé lue à l'écran, comme la saisirait l'utilisateur), code TOTP ensuite.
 */
export async function seConnecterAvecMfa(page: Page, email: string): Promise<void> {
  await seConnecter(page, email);
  const etat = lireEtats()[email];
  if (etat) {
    const champ = page.getByLabel(/Code de vérification/);
    await champ.fill(await codeFrais(email, etat.secret));
    await page.getByRole('button', { name: 'Vérifier le code' }).click();
    await expect(page).not.toHaveURL(/\/connexion/);
    return;
  }
  await expect(page).toHaveURL(/\/mon-compte\/securite/);
  await page.getByRole('button', { name: 'Configurer la double authentification' }).click();
  const secret = (
    await page
      .getByRole('listitem')
      .filter({ hasText: 'saisissez manuellement la clé' })
      .locator('code')
      .innerText()
  ).trim();
  await page.getByLabel(/Code de vérification/).fill(await codeFrais(email, secret));
  await page.getByRole('button', { name: 'Activer' }).click();
  await expect(page.getByText('Activée', { exact: true })).toBeVisible();
}
