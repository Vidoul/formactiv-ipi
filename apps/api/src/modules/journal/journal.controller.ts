import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CodeRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { JournalQueryDto, PageJournalDto } from './dto/journal.dto';
import { JournalConsultationService } from './journal-consultation.service';

@ApiTags('Journal d’audit')
@ApiBearerAuth('jwt')
@Controller('journal')
export class JournalController {
  constructor(private readonly consultation: JournalConsultationService) {}

  @Get()
  @Roles(CodeRole.ADMIN)
  @ApiOperation({
    summary: 'Consultation filtrée du journal (UC-15, RG-LOG-01)',
    description: 'Filtres utilisateur, action et période ; réservé à l’administrateur.',
  })
  @ApiOkResponse({ type: PageJournalDto })
  lister(@Query() q: JournalQueryDto) {
    return this.consultation.lister(q);
  }
}
