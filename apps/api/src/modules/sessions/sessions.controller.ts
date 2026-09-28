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
  CreationSessionDto,
  DisponibiliteFormateurDto,
  ListeSessionsQueryDto,
  ModificationSessionDto,
  PeriodeQueryDto,
  SessionDto,
} from './dto/sessions.dto';
import { SessionsService } from './sessions.service';

@ApiTags('Sessions et affectations')
@ApiBearerAuth('jwt')
@Controller()
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get('sessions')
  @Authentifie()
  @ApiOperation({
    summary: 'Liste des sessions selon la portée (UC-07)',
    description:
      'Toutes (admin, responsable), ses sessions (formateur, apprenant), celles de ses salariés (client).',
  })
  lister(@UtilisateurConnecte() acteur: UtilisateurAuthentifie, @Query() q: ListeSessionsQueryDto) {
    return this.sessions.lister(acteur, q);
  }

  @Get('sessions/:id')
  @Authentifie()
  @ApiOkResponse({ type: SessionDto })
  detail(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sessions.detail(acteur, id);
  }

  @Post('sessions')
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Planification d’une session (US-10, RG-SESS-01)' })
  @ApiOkResponse({ type: SessionDto })
  creer(@UtilisateurConnecte() acteur: UtilisateurAuthentifie, @Body() dto: CreationSessionDto) {
    return this.sessions.creer(acteur, dto);
  }

  @Patch('sessions/:id')
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Modification des dates, du lieu ou de la capacité' })
  @ApiOkResponse({ type: SessionDto })
  modifier(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModificationSessionDto,
  ) {
    return this.sessions.modifier(acteur, id, dto);
  }

  @Delete('sessions/:id')
  @Roles(CodeRole.RESP_FORMATION)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression d’une session sans inscription' })
  supprimer(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.sessions.supprimer(acteur, id);
  }

  @Post('sessions/:id/formateurs/:idFormateur')
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Affectation d’un formateur (US-11, RG-SESS-02)' })
  @ApiOkResponse({ type: SessionDto })
  affecter(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('idFormateur', ParseUUIDPipe) idFormateur: string,
  ) {
    return this.sessions.affecterFormateur(acteur, id, idFormateur);
  }

  @Delete('sessions/:id/formateurs/:idFormateur')
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Retrait d’un formateur' })
  @ApiOkResponse({ type: SessionDto })
  retirer(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('idFormateur', ParseUUIDPipe) idFormateur: string,
  ) {
    return this.sessions.retirerFormateur(acteur, id, idFormateur);
  }

  @Get('formateurs/disponibilites')
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Formateurs et conflits d’agenda sur une période' })
  @ApiOkResponse({ type: [DisponibiliteFormateurDto] })
  disponibilites(@Query() q: PeriodeQueryDto) {
    return this.sessions.disponibilites(q);
  }
}
