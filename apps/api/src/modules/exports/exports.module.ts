import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

/** Module E5 — exports PDF et CSV limités à la portée du rôle (US-22, RG-EXP-01). */
@Module({
  controllers: [ExportsController],
  providers: [ExportsService],
})
export class ExportsModule {}
