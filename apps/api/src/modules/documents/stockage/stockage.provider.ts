import type { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environnement } from '../../../config/environnement';
import { STOCKAGE, type Stockage } from './stockage';
import { StockageLocal } from './stockage-local';
import { StockageS3 } from './stockage-s3';

export type ConfigurationStockage = Pick<
  Environnement,
  | 'STORAGE_DRIVER'
  | 'STORAGE_LOCAL_DIR'
  | 'S3_ENDPOINT'
  | 'S3_REGION'
  | 'S3_BUCKET'
  | 'S3_ACCESS_KEY_ID'
  | 'S3_SECRET_ACCESS_KEY'
>;

/** Choix de l'implémentation selon STORAGE_DRIVER (ADR-05, chapitre 12). */
export function creerStockage(c: ConfigurationStockage): Stockage {
  if (c.STORAGE_DRIVER === 's3') {
    return new StockageS3({
      endpoint: c.S3_ENDPOINT,
      region: c.S3_REGION ?? 'eu-west-3',
      bucket: c.S3_BUCKET ?? '',
      accessKeyId: c.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: c.S3_SECRET_ACCESS_KEY ?? '',
    });
  }
  return new StockageLocal(c.STORAGE_LOCAL_DIR);
}

export const fournisseurStockage: Provider = {
  provide: STOCKAGE,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Environnement, true>): Stockage =>
    creerStockage({
      STORAGE_DRIVER: config.get('STORAGE_DRIVER', { infer: true }),
      STORAGE_LOCAL_DIR: config.get('STORAGE_LOCAL_DIR', { infer: true }),
      S3_ENDPOINT: config.get('S3_ENDPOINT', { infer: true }),
      S3_REGION: config.get('S3_REGION', { infer: true }),
      S3_BUCKET: config.get('S3_BUCKET', { infer: true }),
      S3_ACCESS_KEY_ID: config.get('S3_ACCESS_KEY_ID', { infer: true }),
      S3_SECRET_ACCESS_KEY: config.get('S3_SECRET_ACCESS_KEY', { infer: true }),
    }),
};
