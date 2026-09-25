import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Client Prisma partagé (requêtes paramétrées : protection contre l'injection SQL, OWASP A03).
 * La connexion est ouverte paresseusement à la première requête.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
