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
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CodeRole } from '@prisma/client';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { Authentifie, Roles } from '../../common/decorators/roles.decorator';
import { UtilisateurConnecte } from '../../common/decorators/utilisateur-connecte.decorator';
import {
  CreationUtilisateurDto,
  ListeUtilisateursQueryDto,
  ModificationUtilisateurDto,
  PageUtilisateursDto,
  ResultatSuppressionDto,
  UtilisateurDetailDto,
} from './dto/utilisateurs.dto';
import { UtilisateursService } from './utilisateurs.service';

@ApiTags('Utilisateurs et rôles')
@ApiBearerAuth('jwt')
@Controller()
export class UtilisateursController {
  constructor(private readonly utilisateurs: UtilisateursService) {}

  @Get('utilisateurs')
  @Roles(CodeRole.ADMIN, CodeRole.RESP_FORMATION, CodeRole.FORMATEUR, CodeRole.CLIENT_ENTREPRISE)
  @ApiOperation({
    summary: 'Liste paginée des comptes (UC-03)',
    description:
      'Portée : tous (admin, responsable), apprenants de ses sessions (formateur), salariés de son entreprise (client).',
  })
  @ApiOkResponse({ type: PageUtilisateursDto })
  lister(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Query() q: ListeUtilisateursQueryDto,
  ) {
    return this.utilisateurs.lister(acteur, q);
  }

  @Post('utilisateurs')
  @Roles(CodeRole.ADMIN, CodeRole.RESP_FORMATION)
  @ApiOperation({
    summary: 'Création de compte et envoi du lien d’activation (US-01, RG-CPT-01)',
    description:
      'Le consentement explicite est recueilli à l’activation par le titulaire (RG-RGPD-01).',
  })
  @ApiCreatedResponse({ type: UtilisateurDetailDto })
  creer(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Body() dto: CreationUtilisateurDto,
  ) {
    return this.utilisateurs.creer(acteur, dto);
  }

  @Get('utilisateurs/:id')
  @Authentifie()
  @ApiOperation({ summary: 'Détail d’un compte selon la portée RBAC' })
  @ApiOkResponse({ type: UtilisateurDetailDto })
  detail(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.utilisateurs.detail(acteur, id);
  }

  @Patch('utilisateurs/:id')
  @Authentifie()
  @ApiOperation({
    summary: 'Modification d’un compte (US-02)',
    description: 'Administration : tous les champs. Soi-même : nom et prénom (rectification RGPD).',
  })
  @ApiOkResponse({ type: UtilisateurDetailDto })
  modifier(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModificationUtilisateurDto,
  ) {
    return this.utilisateurs.modifier(acteur, id, dto);
  }

  @Delete('utilisateurs/:id')
  @Roles(CodeRole.ADMIN)
  @ApiOperation({ summary: 'Suppression ou anonymisation si historique (RG-CPT-02)' })
  @ApiOkResponse({ type: ResultatSuppressionDto })
  async supprimer(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResultatSuppressionDto> {
    return { resultat: await this.utilisateurs.supprimer(acteur, id) };
  }

  @Post('utilisateurs/:id/activation')
  @Roles(CodeRole.ADMIN, CodeRole.RESP_FORMATION)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Renvoi du lien d’activation d’un compte non activé' })
  renvoyerActivation(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.utilisateurs.renvoyerActivation(acteur, id);
  }

  @Get('roles')
  @Roles(CodeRole.ADMIN, CodeRole.RESP_FORMATION)
  @ApiOperation({ summary: 'Liste des rôles (5 profils, REQ-FUNC-001)' })
  roles() {
    return this.utilisateurs.roles();
  }
}
