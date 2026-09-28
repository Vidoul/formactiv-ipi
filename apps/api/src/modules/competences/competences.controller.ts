import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CodeRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CompetencesService } from './competences.service';
import {
  CompetenceDto,
  CreationCompetenceDto,
  ListeCompetencesQueryDto,
  ModificationCompetenceDto,
} from './dto/competences.dto';

@ApiTags('Formations et compétences')
@ApiBearerAuth('jwt')
@Controller('competences')
export class CompetencesController {
  constructor(private readonly competences: CompetencesService) {}

  @Get()
  @Roles(CodeRole.ADMIN, CodeRole.RESP_FORMATION, CodeRole.FORMATEUR)
  @ApiOperation({ summary: 'Référentiels RNCP et interne (RG-COMP-01)' })
  lister(@Query() q: ListeCompetencesQueryDto) {
    return this.competences.lister(q);
  }

  @Post()
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Création d’une compétence (US-08)' })
  @ApiOkResponse({ type: CompetenceDto })
  creer(@Body() dto: CreationCompetenceDto) {
    return this.competences.creer(dto);
  }

  @Patch(':id')
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOkResponse({ type: CompetenceDto })
  modifier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModificationCompetenceDto) {
    return this.competences.modifier(id, dto);
  }

  @Delete(':id')
  @Roles(CodeRole.RESP_FORMATION)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression (compétence ni visée ni évaluée)' })
  supprimer(@Param('id', ParseUUIDPipe) id: string) {
    return this.competences.supprimer(id);
  }
}
