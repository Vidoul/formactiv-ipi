import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { CodeRole, FinaliteConsentement } from '@prisma/client';
import type { Response } from 'express';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { Authentifie, Roles } from '../../common/decorators/roles.decorator';
import { UtilisateurConnecte } from '../../common/decorators/utilisateur-connecte.decorator';
import { ConservationService } from './conservation.service';
import {
  CreationDemandeDto,
  DemandeAdministrationDto,
  DemandeDto,
  ListeDemandesQueryDto,
  MesDonneesDto,
  RapportConservationDto,
  RectificationDto,
  TraitementDemandeDto,
} from './dto/rgpd.dto';
import { RgpdService } from './rgpd.service';

const finalite = new ParseEnumPipe(FinaliteConsentement);

@ApiTags('RGPD')
@ApiBearerAuth('jwt')
@Controller('rgpd')
export class RgpdController {
  constructor(
    private readonly rgpd: RgpdService,
    private readonly conservation: ConservationService,
  ) {}

  // ---------------------------------------------------------------- UC-13 (tout utilisateur)

  @Get('mes-donnees')
  @Authentifie()
  @ApiOperation({ summary: 'Droit d’accès : données de l’utilisateur authentifié (US-28)' })
  @ApiOkResponse({ type: MesDonneesDto })
  mesDonnees(@UtilisateurConnecte() acteur: UtilisateurAuthentifie) {
    return this.rgpd.mesDonnees(acteur);
  }

  @Get('mes-donnees/export')
  @Authentifie()
  @Header('Cache-Control', 'no-store')
  @ApiProduces('application/json')
  @ApiOperation({ summary: 'Portabilité : export JSON des données personnelles (journalisé)' })
  async exporter(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { contenu, nomFichier } = await this.rgpd.exporter(acteur);
    res.set({
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nomFichier}"`,
    });
    return new StreamableFile(contenu);
  }

  @Patch('mes-donnees')
  @Authentifie()
  @ApiOperation({ summary: 'Rectification en libre-service du nom et du prénom (US-29)' })
  @ApiOkResponse({ type: MesDonneesDto })
  rectifier(@UtilisateurConnecte() acteur: UtilisateurAuthentifie, @Body() dto: RectificationDto) {
    return this.rgpd.rectifier(acteur, dto);
  }

  @Post('consentements/:finalite')
  @Authentifie()
  @ApiOperation({ summary: 'Donner son consentement à une finalité facultative (RG-RGPD-01)' })
  @ApiOkResponse({ type: MesDonneesDto })
  donner(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('finalite', finalite) f: FinaliteConsentement,
  ) {
    return this.rgpd.donnerConsentement(acteur, f);
  }

  @Delete('consentements/:finalite')
  @Authentifie()
  @ApiOperation({ summary: 'Retirer son consentement (preuve conservée, horodatée)' })
  @ApiOkResponse({ type: MesDonneesDto })
  retirer(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('finalite', finalite) f: FinaliteConsentement,
  ) {
    return this.rgpd.retirerConsentement(acteur, f);
  }

  @Post('demandes')
  @Authentifie()
  @ApiOperation({ summary: 'Dépôt d’une demande : accès, rectification, suppression (US-30)' })
  @ApiCreatedResponse({ type: DemandeDto })
  creerDemande(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Body() dto: CreationDemandeDto,
  ) {
    return this.rgpd.creerDemande(acteur, dto);
  }

  // ---------------------------------------------------------------- UC-14 (administrateur)

  @Get('demandes')
  @Roles(CodeRole.ADMIN)
  @ApiOperation({ summary: 'File de traitement des demandes (écran 07, US-31)' })
  listerDemandes(@Query() q: ListeDemandesQueryDto) {
    return this.rgpd.listerDemandes(q);
  }

  @Patch('demandes/:id')
  @Roles(CodeRole.ADMIN)
  @ApiOperation({
    summary: 'Traitement d’une demande',
    description:
      'Une suppression traitée efface le compte (anonymisation si historique, RG-CPT-02).',
  })
  @ApiOkResponse({ type: DemandeAdministrationDto })
  traiter(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TraitementDemandeDto,
  ) {
    return this.rgpd.traiterDemande(acteur, id, dto);
  }

  @Post('conservation/purge')
  @Roles(CodeRole.ADMIN)
  @ApiOperation({
    summary: 'Exécution immédiate de la politique de conservation (RG-RGPD-04)',
    description: 'Également planifiée chaque mois ; chaque exécution est journalisée.',
  })
  @ApiCreatedResponse({ type: RapportConservationDto })
  purger() {
    return this.conservation.purger();
  }
}
