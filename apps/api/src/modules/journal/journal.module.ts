import { Global, Module } from '@nestjs/common';
import { JournalConsultationService } from './journal-consultation.service';
import { JournalController } from './journal.controller';
import { JournalService } from './journal.service';

/**
 * Module transverse : le journal est alimenté par tous les modules métier (écriture seule) et
 * consulté par l'administrateur (UC-15).
 */
@Global()
@Module({
  controllers: [JournalController],
  providers: [JournalService, JournalConsultationService],
  exports: [JournalService],
})
export class JournalModule {}
