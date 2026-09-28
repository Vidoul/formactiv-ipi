import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Critères automatisables correspondant au niveau visé (RGAA ≈ WCAG 2.1 A et AA, chapitre 11). */
const NORMES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Audit axe-core de la page courante. L'audit automatique ne couvre qu'une partie des critères
 * RGAA : il complète, sans la remplacer, la revue manuelle (lecteur d'écran, clavier).
 */
export async function auditerAccessibilite(page: Page, contexte: string): Promise<void> {
  const resultat = await new AxeBuilder({ page }).withTags(NORMES).analyze();
  const violations = resultat.violations.map(
    (v) =>
      `${v.id} (${v.impact ?? 'inconnu'}) : ${v.help} — ${v.nodes
        .slice(0, 3)
        .map((n) => n.target.join(' '))
        .join(' | ')}`,
  );
  // Garde-fou : l'audit a bien porté sur un contenu rendu (règles effectivement évaluées).
  expect(resultat.passes.length, `Audit vide sur ${contexte}`).toBeGreaterThan(10);
  expect(violations, `Violations d'accessibilité sur ${contexte}`).toEqual([]);
}
