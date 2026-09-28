import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { COMPTES, seConnecter, seConnecterAvecMfa } from '../utils/session';

/**
 * Parcours métier de bout en bout sur le jeu de démonstration, dans l'ordre d'usage réel :
 * le responsable génère un certificat, l'apprenante le télécharge, le formateur saisit une note,
 * le client entreprise consulte ses salariés, l'administrateur traite une demande RGPD.
 */
test.describe.serial('Parcours de formation (UC-08 à UC-15)', () => {
  let reference = '';

  test('responsable : génère le certificat de Léa Martin et exporte les résultats', async ({
    page,
  }) => {
    await seConnecterAvecMfa(page, COMPTES.responsable);
    await page.goto('/documents');
    await expect(page.getByRole('heading', { name: 'Attestations et certificats' })).toBeVisible();
    await choisirSessionCyberPassee(page);

    await page.getByRole('button', { name: 'Générer le certificat de Léa Martin' }).click();
    const notification = page.getByText(/Certificat C-\d{4}-\d{4} généré pour Léa Martin\./);
    await expect(notification).toBeVisible();
    reference = /C-\d{4}-\d{4}/.exec((await notification.textContent()) ?? '')![0];
    await expect(page.getByRole('row', { name: /Léa Martin/ })).toContainText(reference);

    const telechargement = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter les résultats (CSV)' }).click();
    const fichier = await telechargement;
    expect(fichier.suggestedFilename()).toMatch(/^formactiv-evaluations-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = readFileSync(await fichier.path(), 'utf8');
    expect(csv.startsWith('\uFEFFFormation;Session;Apprenant;Entreprise;Compétence')).toBe(true);
    expect(csv).toContain('Léa Martin');
  });

  test('apprenante : retrouve le certificat et le télécharge par lien signé', async ({ page }) => {
    await seConnecter(page, COMPTES.apprenante);
    await page.getByRole('link', { name: 'Mes documents' }).click();
    const ligne = page.getByRole('row', { name: new RegExp(reference) });
    await expect(ligne).toBeVisible();

    const telechargement = page.waitForEvent('download');
    await ligne.getByRole('button', { name: /Télécharger/ }).click();
    const fichier = await telechargement;
    expect(fichier.suggestedFilename()).toBe(`formactiv-${reference}.pdf`);
    expect(
      readFileSync(await fichier.path())
        .subarray(0, 8)
        .toString(),
    ).toBe('%PDF-1.7');

    await page.getByRole('link', { name: 'Mon parcours' }).click();
    await expect(
      page.getByRole('table', { name: 'Parcours de formation de Léa Martin' }),
    ).toContainText(reference);
  });

  test('formateur : complète une note manquante de la feuille d’évaluation', async ({ page }) => {
    await seConnecter(page, COMPTES.formateur);
    await page.goto('/formateur/evaluations');
    await expect(page.getByRole('table', { name: /Notes de la session/ })).toBeVisible();
    const champs = page.getByRole('textbox', { name: /^Note de / });
    const vides = await champs.evaluateAll((elements) =>
      elements.flatMap((e, rang) => ((e as HTMLInputElement).value === '' ? [rang] : [])),
    );
    expect(vides.length).toBeGreaterThan(0);
    await champs.nth(vides[0]).fill('14,5');
    await page.getByRole('button', { name: 'Enregistrer les notes' }).click();
    await expect(page.getByText('Notes enregistrées.')).toBeVisible();
  });

  test('client entreprise : consulte ses seuls salariés, sans note détaillée', async ({ page }) => {
    await seConnecter(page, COMPTES.client);
    await expect(
      page.getByRole('heading', { name: 'Groupe Oxalys - Suivi des formations' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Mes salariés' }).click();
    const tableau = page.getByRole('table', { name: /Salariés de Groupe Oxalys/ });
    await expect(tableau.getByRole('row', { name: /Léa Martin.*Certificat obtenu/ })).toBeVisible();
    await expect(tableau.getByRole('columnheader', { name: /Note/ })).toHaveCount(0);
  });

  test('administrateur : traite une demande de rectification et la retrouve au journal', async ({
    page,
  }) => {
    await seConnecterAvecMfa(page, COMPTES.admin);
    await page.goto('/admin/rgpd');
    const ligne = page.getByRole('row', { name: /s\.blanc@mail\.fr/ });
    const numero = (await ligne.getByRole('rowheader').textContent())!.trim();
    await ligne.getByRole('button', { name: `Traiter la demande ${numero}` }).click();
    const dialogue = page.getByRole('dialog');
    await dialogue.getByLabel('Décision').selectOption('TRAITEE');
    await dialogue.getByLabel(/Réponse au demandeur/).fill('Nom corrigé : Blancq.');
    await dialogue.getByRole('button', { name: 'Enregistrer la décision' }).click();
    await expect(page.getByText(`Demande ${numero} : traitée.`)).toBeVisible();

    await page.goto('/admin/journal');
    await page.getByLabel('Action').selectOption('TRAITEMENT_DEMANDE_RGPD');
    await page.getByRole('button', { name: 'Appliquer' }).click();
    await expect(page.getByRole('table', { name: /Journal d’audit/ })).toContainText(
      `${numero} — RECTIFICATION : RECUE → TRAITEE`,
    );
  });
});

/** Session de cybersécurité terminée du jeu de démonstration (J-40 à J-36). */
async function choisirSessionCyberPassee(page: import('@playwright/test').Page): Promise<void> {
  const liste = page.getByLabel('Session');
  const option = liste.locator('option', { hasText: /^Cybersécurité fondamentaux/ }).first();
  await expect(option).toBeAttached();
  await liste.selectOption(await option.getAttribute('value'));
}
