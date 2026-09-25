/**
 * Exporte la spécification OpenAPI générée depuis le code vers docs/api/formactiv-openapi.yaml
 * (livrable « Spécifications API » du chapitre 9, importable dans Swagger Editor).
 *
 *   npm run openapi:export -w apps/api
 *
 * Aucune connexion à la base n'est nécessaire : seules les métadonnées des contrôleurs sont lues.
 */
import '../test/setup-env';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { dump } from 'js-yaml';
import { AppModule } from '../src/app.module';
import { PREFIXE_API, creerDocumentOpenApi } from '../src/app.setup';

async function exporter(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error'] });
  app.setGlobalPrefix(PREFIXE_API);
  const document = creerDocumentOpenApi(app);
  const cible = path.resolve(__dirname, '../../../docs/api/formactiv-openapi.yaml');
  const entete =
    '# Généré par `npm run openapi:export -w apps/api` — NE PAS MODIFIER À LA MAIN.\n' +
    '# Source de vérité : décorateurs @nestjs/swagger des contrôleurs de apps/api/src.\n';
  writeFileSync(cible, entete + dump(document, { noRefs: true, lineWidth: 120 }));
  await app.close();
  console.log(`Spécification OpenAPI exportée : ${cible}`);
}

void exporter();
