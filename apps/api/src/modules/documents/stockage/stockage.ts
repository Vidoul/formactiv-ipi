/**
 * Stockage des documents générés (ADR-05) : les PDF sont déposés dans un stockage objet et seule
 * leur clé est conservée en base (table document). Deux implémentations :
 * - `local` (DEV / TEST) : dossier du serveur ;
 * - `s3` (PROD) : stockage objet compatible S3 hébergé dans l'UE.
 */
export interface ObjetStocke {
  cle: string;
  modifieLe: Date;
}

export interface Stockage {
  deposer(cle: string, contenu: Buffer, typeMime: string): Promise<void>;
  lire(cle: string): Promise<Buffer>;
  supprimer(cle: string): Promise<void>;
  /** Objets dont la clé commence par `prefixe` (purge des fichiers orphelins, RG-RGPD-04). */
  lister(prefixe: string): Promise<ObjetStocke[]>;
}

export const STOCKAGE = Symbol('STOCKAGE');

/** Les clés sont générées par l'API, jamais fournies par l'utilisateur (A01 / A10). */
export const MOTIF_CLE = /^[a-z0-9-]+(\/[a-z0-9-]+)*\.(pdf|csv)$/;

export function verifierCle(cle: string): void {
  if (!MOTIF_CLE.test(cle)) throw new Error(`Clé de stockage invalide : ${cle}`);
}
