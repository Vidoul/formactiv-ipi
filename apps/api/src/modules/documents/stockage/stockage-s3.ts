import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { verifierCle, type ObjetStocke, type Stockage } from './stockage';

export interface ConfigurationS3 {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * Stockage objet compatible S3 (PROD, ADR-05) : hébergeur européen, chiffrement au repos assuré
 * par le fournisseur, bucket privé (aucun accès public : téléchargement via l'API et URL signée).
 */
export class StockageS3 implements Stockage {
  private readonly client: S3Client;

  constructor(private readonly config: ConfigurationS3) {
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint || undefined,
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async deposer(cle: string, contenu: Buffer, typeMime: string): Promise<void> {
    verifierCle(cle);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: cle,
        Body: contenu,
        ContentType: typeMime,
      }),
    );
  }

  async lire(cle: string): Promise<Buffer> {
    verifierCle(cle);
    const reponse = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: cle }),
    );
    if (!reponse.Body) throw new Error(`Objet vide : ${cle}`);
    return Buffer.from(await reponse.Body.transformToByteArray());
  }

  async supprimer(cle: string): Promise<void> {
    verifierCle(cle);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: cle }));
  }

  async lister(prefixe: string): Promise<ObjetStocke[]> {
    const objets: ObjetStocke[] = [];
    let suite: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.config.bucket,
          Prefix: prefixe,
          ContinuationToken: suite,
        }),
      );
      for (const o of page.Contents ?? []) {
        if (o.Key) objets.push({ cle: o.Key, modifieLe: o.LastModified ?? new Date(0) });
      }
      suite = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (suite);
    return objets;
  }
}
