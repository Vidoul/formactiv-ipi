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
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { Authentifie, Roles } from '../../common/decorators/roles.decorator';
import { UtilisateurConnecte } from '../../common/decorators/utilisateur-connecte.decorator';
import {
  AjoutCompetenceDto,
  CreationFormationDto,
  FormationDetailDto,
  ListeFormationsQueryDto,
  ModificationFormationDto,
} from './dto/formations.dto';
import { FormationsService } from './formations.service';

@ApiTags('Formations et compétences')
@ApiBearerAuth('jwt')
@Controller('formations')
export class FormationsController {
  constructor(private readonly formations: FormationsService) {}

  @Get()
  @Authentifie()
  @ApiOperation({
    summary: 'Catalogue des formations',
    description: 'Publiées seulement pour les apprenants et les clients entreprise (RG-FORM-03).',
  })
  lister(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Query() q: ListeFormationsQueryDto,
  ) {
    return this.formations.lister(acteur, q);
  }

  @Get(':id')
  @Authentifie()
  @ApiOkResponse({ type: FormationDetailDto })
  detail(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.formations.detail(acteur, id);
  }

  @Post()
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Création d’une formation au statut brouillon (UC-04, RG-FORM-01)' })
  @ApiOkResponse({ type: FormationDetailDto })
  creer(@Body() dto: CreationFormationDto) {
    return this.formations.creer(dto);
  }

  @Patch(':id')
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Paramétrage, publication, archivage (RG-FORM-03)' })
  @ApiOkResponse({ type: FormationDetailDto })
  modifier(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ModificationFormationDto) {
    return this.formations.modifier(id, dto);
  }

  @Delete(':id')
  @Roles(CodeRole.RESP_FORMATION)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression d’un brouillon sans session' })
  supprimer(@Param('id', ParseUUIDPipe) id: string) {
    return this.formations.supprimer(id);
  }

  @Get(':id/competences')
  @Authentifie()
  @ApiOperation({ summary: 'Compétences visées par la formation (RG-FORM-02)' })
  async competences(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return (await this.formations.detail(acteur, id)).competences;
  }

  @Post(':id/competences')
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Associe une compétence à la formation (US-07)' })
  @ApiOkResponse({ type: FormationDetailDto })
  ajouterCompetence(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AjoutCompetenceDto) {
    return this.formations.ajouterCompetence(id, dto.competenceId);
  }

  @Delete(':id/competences/:competenceId')
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Retire une compétence non encore évaluée' })
  @ApiOkResponse({ type: FormationDetailDto })
  retirerCompetence(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('competenceId', ParseUUIDPipe) competenceId: string,
  ) {
    return this.formations.retirerCompetence(id, competenceId);
  }
}
