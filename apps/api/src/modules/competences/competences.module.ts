import { Module } from '@nestjs/common';
import { CompetencesController } from './competences.controller';
import { CompetencesService } from './competences.service';

/** Module E2 — référentiels de compétences (US-08). */
@Module({
  controllers: [CompetencesController],
  providers: [CompetencesService],
  exports: [CompetencesService],
})
export class CompetencesModule {}
