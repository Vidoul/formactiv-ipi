import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
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
  IndicateursDto,
  IndicateursQueryDto,
  PageSalariesDto,
  ReponseSatisfactionDto,
  SalariesQueryDto,
  SatisfactionEnregistreeDto,
  TableauAdministrationDto,
  TableauApprenantDto,
  TableauFormateurDto,
} from './dto/reporting.dto';
import { ReportingService } from './reporting.service';

@ApiTags('Reporting et tableaux de bord')
@ApiBearerAuth('jwt')
@Controller()
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}

  @Get('reporting/indicateurs')
  @Authentifie()
  @ApiOperation({
    summary: 'Taux de réussite, complétion, satisfaction (US-23, RG-DASH-01)',
    description:
      'Portée par rôle (RG-DASH-02) ; filtres période, formation et entreprise — ce dernier ' +
      'réservé à l’administration (RG-DASH-03). Comparaison avec la période précédente.',
  })
  @ApiOkResponse({ type: IndicateursDto })
  indicateurs(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Query() q: IndicateursQueryDto,
  ) {
    return this.reporting.indicateurs(acteur, q);
  }

  @Get('reporting/administration')
  @Roles(CodeRole.ADMIN)
  @ApiOperation({ summary: 'Tableau de bord technique et conformité (écran 05, US-27)' })
  @ApiOkResponse({ type: TableauAdministrationDto })
  administration() {
    return this.reporting.administration();
  }

  @Get('reporting/formateur')
  @Roles(CodeRole.FORMATEUR)
  @ApiOperation({ summary: 'Progression des groupes du formateur (écran 17, US-25)' })
  @ApiOkResponse({ type: TableauFormateurDto })
  formateur(@UtilisateurConnecte() acteur: UtilisateurAuthentifie) {
    return this.reporting.formateur(acteur);
  }

  @Get('reporting/apprenant')
  @Roles(CodeRole.APPRENANT)
  @ApiOperation({ summary: 'Progression et prochaines échéances de l’apprenant (écran 18, US-24)' })
  @ApiOkResponse({ type: TableauApprenantDto })
  apprenant(@UtilisateurConnecte() acteur: UtilisateurAuthentifie) {
    return this.reporting.apprenant(acteur);
  }

  @Get('reporting/salaries')
  @Roles(CodeRole.CLIENT_ENTREPRISE, CodeRole.ADMIN, CodeRole.RESP_FORMATION)
  @ApiOperation({
    summary: 'Salariés en formation et avancement synthétique (écran 21b, US-26)',
    description: 'Client entreprise : ses seuls salariés, sans note détaillée (minimisation).',
  })
  @ApiOkResponse({ type: PageSalariesDto })
  salaries(@UtilisateurConnecte() acteur: UtilisateurAuthentifie, @Query() q: SalariesQueryDto) {
    return this.reporting.salaries(acteur, q);
  }

  @Post('inscriptions/:id/satisfaction')
  @Roles(CodeRole.APPRENANT)
  @ApiOperation({
    summary: 'Réponse au questionnaire de satisfaction (RG-DASH-04)',
    description: 'Inscription terminée, une réponse ; consentement explicite recueilli si besoin.',
  })
  @ApiCreatedResponse({ type: SatisfactionEnregistreeDto })
  satisfaction(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReponseSatisfactionDto,
  ) {
    return this.reporting.repondreSatisfaction(acteur, id, dto);
  }
}
