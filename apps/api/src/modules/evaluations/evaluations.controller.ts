import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CodeRole } from '@prisma/client';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { Authentifie, Roles } from '../../common/decorators/roles.decorator';
import { UtilisateurConnecte } from '../../common/decorators/utilisateur-connecte.decorator';
import {
  CorrectionNoteDto,
  EvaluationDto,
  FeuilleEvaluationDto,
  SaisieFeuilleDto,
  SaisieNoteDto,
} from './dto/evaluations.dto';
import { EvaluationsService } from './evaluations.service';

@ApiTags('Évaluations')
@ApiBearerAuth('jwt')
@Controller()
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get('inscriptions/:id/evaluations')
  @Authentifie()
  @ApiOperation({
    summary: 'Notes et acquisitions d’une inscription (US-17, US-18)',
    description: 'Portée RBAC ; le client entreprise ne reçoit que la synthèse (sans note).',
  })
  @ApiOkResponse({ type: [EvaluationDto] })
  lister(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evaluations.lister(acteur, id);
  }

  @Post('inscriptions/:id/evaluations')
  @Roles(CodeRole.FORMATEUR)
  @ApiOperation({ summary: 'Saisie d’une note par compétence (US-16, RG-EVAL-01/02)' })
  @ApiOkResponse({ type: EvaluationDto })
  saisir(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaisieNoteDto,
  ) {
    return this.evaluations.saisir(acteur, id, dto);
  }

  @Patch('evaluations/:id')
  @Roles(CodeRole.FORMATEUR)
  @ApiOperation({ summary: 'Correction d’une note (ancienne valeur journalisée, UC-08 A1)' })
  @ApiOkResponse({ type: EvaluationDto })
  corriger(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CorrectionNoteDto,
  ) {
    return this.evaluations.corriger(acteur, id, dto.note);
  }

  @Get('sessions/:id/feuille-evaluation')
  @Roles(CodeRole.ADMIN, CodeRole.RESP_FORMATION, CodeRole.FORMATEUR)
  @ApiOperation({ summary: 'Feuille d’évaluation d’une session (écran 16)' })
  @ApiOkResponse({ type: FeuilleEvaluationDto })
  feuille(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.evaluations.feuille(acteur, id);
  }

  @Put('sessions/:id/feuille-evaluation')
  @Roles(CodeRole.FORMATEUR)
  @ApiOperation({
    summary: 'Enregistrement groupé des notes de la session (formateur affecté)',
  })
  @ApiOkResponse({ type: FeuilleEvaluationDto })
  enregistrerFeuille(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaisieFeuilleDto,
  ) {
    return this.evaluations.enregistrerFeuille(acteur, id, dto.notes);
  }
}
