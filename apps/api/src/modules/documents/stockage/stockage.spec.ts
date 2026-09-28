import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { StockageLocal } from './stockage-local';
import { verifierCle } from './stockage';

describe('Stockage des documents (ADR-05)', () => {
  let dossier: string;
  let stockage: StockageLocal;

  beforeEach(async () => {
    dossier = await mkdtemp(path.join(os.tmpdir(), 'formactiv-stockage-'));
    stockage = new StockageLocal(dossier);
  });
  afterEach(async () => {
    await rm(dossier, { recursive: true, force: true });
  });

  it('dépose, relit et supprime un document', async () => {
    const contenu = Buffer.from('%PDF-1.7 essai');
    await stockage.deposer('documents/2026/abc-123.pdf', contenu);
    await expect(stockage.lire('documents/2026/abc-123.pdf')).resolves.toEqual(contenu);
    await stockage.supprimer('documents/2026/abc-123.pdf');
    await expect(stockage.lire('documents/2026/abc-123.pdf')).rejects.toThrow();
  });

  it('liste les objets d’un préfixe avec leur date de modification', async () => {
    await stockage.deposer('documents/2025/a.pdf', Buffer.from('a'));
    await stockage.deposer('documents/2026/b.pdf', Buffer.from('b'));
    const objets = await stockage.lister('documents');
    expect(objets.map((o) => o.cle).sort()).toEqual([
      'documents/2025/a.pdf',
      'documents/2026/b.pdf',
    ]);
    expect(objets[0].modifieLe.getTime()).toBeGreaterThan(Date.now() - 60_000);
    await expect(stockage.lister('inexistant')).resolves.toEqual([]);
    await expect(stockage.lister('../')).rejects.toThrow(/hors du dossier/);
  });

  it('refuse les clés permettant une traversée de chemin', () => {
    for (const cle of [
      '../secret.pdf',
      'documents/../../x.pdf',
      '/etc/passwd',
      'a\\b.pdf',
      'x.exe',
    ]) {
      expect(() => verifierCle(cle)).toThrow(/invalide/);
    }
    expect(() => verifierCle('documents/2026/0f1e-2d3c.pdf')).not.toThrow();
  });
});
