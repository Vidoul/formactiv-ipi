import { Module } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

/** Module E6 — tableaux de bord, indicateurs et satisfaction (US-23..27, RG-DASH-01..04). */
@Module({
  controllers: [ReportingController],
  providers: [ReportingService],
})
export class ReportingModule {}
