import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { PREFIXE_API, configurerApplication } from './app.setup';
import type { Environnement } from './config/environnement';

async function demarrer(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  configurerApplication(app);

  const config = app.get<ConfigService<Environnement, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  const logger = new Logger('Démarrage');
  logger.log(`API FORMACTIV disponible sur http://localhost:${port}/${PREFIXE_API}`);
  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    logger.log(`Documentation OpenAPI : http://localhost:${port}/api/docs`);
  }
}

void demarrer();
