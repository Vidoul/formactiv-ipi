import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { FiltreExceptions } from './common/filters/filtre-exceptions';
import { DonneesSensiblesInterceptor } from './common/interceptors/donnees-sensibles.interceptor';
import { creerValidationPipe } from './common/validation';
import { Environnement, validerEnvironnement } from './config/environnement';
import { JournalModule } from './modules/journal/journal.module';
import { SanteModule } from './modules/sante/sante.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Module racine — monolithe modulaire (ADR-02) : un module NestJS par domaine métier
 * (auth, utilisateurs, formations, sessions, inscriptions, évaluations, documents, reporting,
 * rgpd, journal), aux frontières étanches pour permettre une extraction ultérieure (V2).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validerEnvironnement }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Environnement, true>) => [
        {
          name: 'global',
          ttl: 60_000,
          limit: config.get('THROTTLE_LIMITE_GLOBALE', { infer: true }),
        },
      ],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    JournalModule,
    SanteModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: creerValidationPipe },
    { provide: APP_FILTER, useClass: FiltreExceptions },
    { provide: APP_INTERCEPTOR, useClass: DonneesSensiblesInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
