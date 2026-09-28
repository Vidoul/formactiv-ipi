import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { FiltreExceptions } from './common/filters/filtre-exceptions';
import { AuthentificationGuard } from './common/guards/authentification.guard';
import { MfaObligatoireGuard } from './common/guards/mfa-obligatoire.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DonneesSensiblesInterceptor } from './common/interceptors/donnees-sensibles.interceptor';
import { creerValidationPipe } from './common/validation';
import { Environnement, validerEnvironnement } from './config/environnement';
import { AuthModule } from './modules/auth/auth.module';
import { CompetencesModule } from './modules/competences/competences.module';
import { EntreprisesModule } from './modules/entreprises/entreprises.module';
import { EvaluationsModule } from './modules/evaluations/evaluations.module';
import { FormationsModule } from './modules/formations/formations.module';
import { InscriptionsModule } from './modules/inscriptions/inscriptions.module';
import { JournalModule } from './modules/journal/journal.module';
import { MailModule } from './modules/mail/mail.module';
import { ParametresModule } from './modules/parametres/parametres.module';
import { SanteModule } from './modules/sante/sante.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { UtilisateursModule } from './modules/utilisateurs/utilisateurs.module';
import { PrismaModule } from './prisma/prisma.module';

/**
 * Module racine — monolithe modulaire (ADR-02) : un module NestJS par domaine métier
 * (auth, utilisateurs, formations, sessions, inscriptions, évaluations, documents, reporting,
 * rgpd, journal), aux frontières étanches pour permettre une extraction ultérieure (V2).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Les tests n'utilisent que les variables injectées par test/setup-env.ts (reproductibilité).
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validerEnvironnement,
    }),
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
    ParametresModule,
    MailModule,
    SanteModule,
    AuthModule,
    UtilisateursModule,
    EntreprisesModule,
    CompetencesModule,
    FormationsModule,
    SessionsModule,
    InscriptionsModule,
    EvaluationsModule,
  ],
  providers: [
    { provide: APP_PIPE, useFactory: creerValidationPipe },
    { provide: APP_FILTER, useClass: FiltreExceptions },
    { provide: APP_INTERCEPTOR, useClass: DonneesSensiblesInterceptor },
    // Gardes globales, exécutées dans cet ordre : limitation de débit, authentification JWT,
    // contrôle des rôles (refus par défaut), MFA obligatoire (RG-AUTH-03).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthentificationGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: MfaObligatoireGuard },
  ],
})
export class AppModule {}
