import { Global, Module } from '@nestjs/common';
import { JournalService } from './journal.service';

/** Module transverse : le journal est alimenté par tous les modules métier. */
@Global()
@Module({
  providers: [JournalService],
  exports: [JournalService],
})
export class JournalModule {}
