import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { CodeRole } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { configurerApplication } from '../../src/app.setup';
import {
  CATALOGUE_PARAMETRES,
  CleParametre,
  valeurParDefaut,
} from '../../src/modules/parametres/catalogue-parametres';
import { PrismaService } from '../../src/prisma/prisma.service';

export interface ContexteTest {
  app: NestExpressApplication;
  prisma: PrismaService;
  /** Serveur HTTP à passer à supertest. */
  http: ReturnType<NestExpressApplication['getHttpServer']>;
}

/** Démarre l'application complète (mêmes middlewares, gardes et filtres qu'en production). */
export async function demarrerApplication(): Promise<ContexteTest> {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = module.createNestApplication<NestExpressApplication>({ logger: ['error'] });
  configurerApplication(app);
  await app.init();
  const prisma = app.get(PrismaService);
  return { app, prisma, http: app.getHttpServer() };
}

/**
 * Vide toutes les tables (TRUNCATE ne déclenche pas le trigger ligne à ligne du journal) puis
 * recharge le référentiel minimal : rôles et paramètres.
 */
export async function reinitialiserBase(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const liste = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${liste} RESTART IDENTITY CASCADE`);

  await prisma.role.createMany({
    data: Object.values(CodeRole).map((code) => ({ code, libelle: code })),
  });
  await prisma.parametre.createMany({
    data: Object.entries(CATALOGUE_PARAMETRES).map(([cle, d]) => ({
      cle,
      valeur: valeurParDefaut(cle as CleParametre),
      description: d.description,
    })),
  });
}
