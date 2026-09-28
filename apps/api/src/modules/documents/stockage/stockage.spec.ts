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
