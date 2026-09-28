import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { verifierCle, type ObjetStocke, type Stockage } from './stockage';

/** Stockage sur disque (DEV / TEST, chapitre 12 : « dossier local »). */
export class StockageLocal implements Stockage {
  private readonly racine: string;

  constructor(dossier: string) {
    this.racine = path.resolve(dossier);
  }

  /** Résout la clé sous la racine en refusant toute sortie du dossier (traversée de chemin). */
  private chemin(cle: string): string {
    verifierCle(cle);
    const cible = path.resolve(this.racine, cle);
    if (!cible.startsWith(this.racine + path.sep)) {
      throw new Error('Chemin de stockage hors du dossier autorisé');
    }
    return cible;
  }

  async deposer(cle: string, contenu: Buffer): Promise<void> {
    const cible = this.chemin(cle);
    await mkdir(path.dirname(cible), { recursive: true });
    await writeFile(cible, contenu, { mode: 0o600 });
  }

  lire(cle: string): Promise<Buffer> {
    return readFile(this.chemin(cle));
  }

  async supprimer(cle: string): Promise<void> {
    await rm(this.chemin(cle), { force: true });
  }

  async lister(prefixe: string): Promise<ObjetStocke[]> {
    const dossier = path.resolve(this.racine, prefixe);
    if (dossier !== this.racine && !dossier.startsWith(this.racine + path.sep)) {
      throw new Error('Préfixe de stockage hors du dossier autorisé');
    }
    let entrees: string[];
    try {
      entrees = await readdir(dossier, { recursive: true });
    } catch {
      return [];
    }
    const objets: ObjetStocke[] = [];
    for (const relatif of entrees) {
      const complet = path.join(dossier, relatif);
      const infos = await stat(complet);
      if (!infos.isFile()) continue;
      const cle = path.relative(this.racine, complet).split(path.sep).join('/');
      objets.push({ cle, modifieLe: infos.mtime });
    }
    return objets;
  }
}
