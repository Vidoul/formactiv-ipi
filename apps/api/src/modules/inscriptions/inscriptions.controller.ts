import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CodeRole } from '@prisma/client';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { Authentifie, Roles } from '../../common/decorators/roles.decorator';
import { UtilisateurConnecte } from '../../common/decorators/utilisateur-connecte.decorator';
import {
  CreationInscriptionDto,
  InscriptionDto,
  ListeInscriptionsQueryDto,
  ModificationInscriptionDto,
  ResultatInscriptionDto,
} from './dto/inscriptions.dto';
import { InscriptionsService } from './inscriptions.service';

@ApiTags('Inscriptions')
@ApiBearerAuth('jwt')
@Controller()
export class InscriptionsController {
  constructor(private readonly inscriptions: InscriptionsService) {}

  @Get('inscriptions')
  @Authentifie()
  @ApiOperation({
    summary: 'Suivi des inscriptions (US-13), filtres statut / session / entreprise',
    description: 'Portée RBAC : toutes, ses sessions, son parcours ou son entreprise.',
  })
  lister(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Query() q: ListeInscriptionsQueryDto,
  ) {
    return this.inscriptions.lister(acteur, q);
  }

  @Get('inscriptions/:id')
  @Authentifie()
  @ApiOkResponse({ type: InscriptionDto })
  detail(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.inscriptions.detail(acteur, id);
  }

  @Post('sessions/:id/inscriptions')
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({
    summary: 'Inscription d’un apprenant (US-12, RG-INSC-01/03, RG-SESS-03)',
  })
  @ApiOkResponse({ type: ResultatInscriptionDto })
  inscrire(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: CreationInscriptionDto,
  ) {
    return this.inscriptions.inscrire(acteur, sessionId, dto.apprenantId);
  }

  @Patch('inscriptions/:id')
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Changement de statut : valider, annuler, terminer (RG-INSC-02)' })
  @ApiOkResponse({ type: InscriptionDto })
  modifier(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModificationInscriptionDto,
  ) {
    return this.inscriptions.modifier(acteur, id, dto);
  }
}
