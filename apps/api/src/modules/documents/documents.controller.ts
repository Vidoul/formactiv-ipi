import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
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
import { CodeRole } from '@prisma/client';
import type { Response } from 'express';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { Public } from '../../common/decorators/public.decorator';
import { Authentifie, Roles } from '../../common/decorators/roles.decorator';
import { UtilisateurConnecte } from '../../common/decorators/utilisateur-connecte.decorator';
import { DocumentsService } from './documents.service';
import {
  BilanDocumentsSessionDto,
  DocumentDto,
  GenerationDocumentDto,
  LienTelechargementDto,
  ListeDocumentsQueryDto,
  ParcoursDto,
  TelechargementQueryDto,
} from './dto/documents.dto';
import { ParcoursService } from './parcours.service';

@ApiTags('Documents et parcours')
@ApiBearerAuth('jwt')
@Controller()
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly parcoursService: ParcoursService,
  ) {}

  @Get('documents')
  @Authentifie()
  @ApiOperation({
    summary: 'Attestations et certificats visibles (US-20)',
    description:
      'Portée RBAC : l’apprenant ne voit que ses documents, le client ceux de ses salariés.',
  })
  lister(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Query() q: ListeDocumentsQueryDto,
  ) {
    return this.documents.lister(acteur, q);
  }

  @Get('documents/:id')
  @Authentifie()
  @ApiOperation({
    summary: 'Lien de téléchargement signé de courte durée (UC-10, ADR-05)',
  })
  @ApiOkResponse({ type: LienTelechargementDto })
  lien(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.lienTelechargement(acteur, id);
  }

  @Get('documents/:id/fichier')
  @Public()
  @Header('Cache-Control', 'no-store')
  @ApiProduces('application/pdf')
  @ApiOperation({
    summary: 'Téléchargement du PDF via l’URL signée',
    description:
      'Route sans jeton : la signature HMAC, l’expiration, le compte, la portée RBAC et ' +
      'l’empreinte SHA-256 du fichier sont vérifiés.',
  })
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async fichier(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() q: TelechargementQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { contenu, nomFichier } = await this.documents.fichier(id, q);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${nomFichier}"`,
    });
    return new StreamableFile(contenu);
  }

  @Post('inscriptions/:id/documents')
  @Roles(CodeRole.RESP_FORMATION)
  @ApiOperation({
    summary: 'Génération d’une attestation ou d’un certificat (US-19, RG-CERT-01/02)',
  })
  @ApiCreatedResponse({ type: DocumentDto })
  generer(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerationDocumentDto,
  ) {
    return this.documents.generer(acteur, id, dto.type);
  }

  @Get('sessions/:id/documents')
  @Roles(CodeRole.ADMIN, CodeRole.RESP_FORMATION, CodeRole.FORMATEUR)
  @ApiOperation({ summary: 'Bilan de génération des documents d’une session (écran 14)' })
  @ApiOkResponse({ type: BilanDocumentsSessionDto })
  bilan(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.bilanSession(acteur, id);
  }

  @Get('utilisateurs/:id/parcours')
  @Authentifie()
  @ApiOperation({
    summary: 'Historique complet du parcours (US-21, RG-HIST-01)',
    description: 'Soi-même, responsable formation, administrateur.',
  })
  @ApiOkResponse({ type: ParcoursDto })
  parcours(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.parcoursService.parcours(acteur, id);
  }
}
