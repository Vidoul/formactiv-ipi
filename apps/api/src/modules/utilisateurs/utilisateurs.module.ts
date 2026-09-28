import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AnonymisationService } from './anonymisation.service';
import { UtilisateursController } from './utilisateurs.controller';
import { UtilisateursService } from './utilisateurs.service';

/** Module E1 — gestion des comptes et des rôles (US-01, US-02, RG-CPT-01/02). */
@Module({
  imports: [AuthModule],
  controllers: [UtilisateursController],
  providers: [UtilisateursService, AnonymisationService],
  exports: [UtilisateursService, AnonymisationService],
})
export class UtilisateursModule {}
