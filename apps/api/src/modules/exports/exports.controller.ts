import { Controller, Get, Header, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { Authentifie } from '../../common/decorators/roles.decorator';
import { UtilisateurConnecte } from '../../common/decorators/utilisateur-connecte.decorator';
import { ExportQueryDto } from './dto/exports.dto';
import { ExportsService } from './exports.service';

@ApiTags('Exports')
@ApiBearerAuth('jwt')
@Controller('exports')
export class ExportsController {
  constructor(private readonly exports: ExportsService) {}

  @Get()
  @Authentifie()
  @Header('Cache-Control', 'no-store')
  @ApiProduces('text/csv', 'application/pdf')
  @ApiOperation({
    summary: 'Export PDF ou CSV du périmètre autorisé (US-22, RG-EXP-01)',
    description:
      'Tous les profils, chacun limité à sa portée : global (administration), ses sessions ' +
      '(formateur), son parcours (apprenant), ses salariés (client entreprise).',
  })
  @ApiOkResponse({ schema: { type: 'string', format: 'binary' } })
  async exporter(
    @UtilisateurConnecte() acteur: UtilisateurAuthentifie,
    @Query() q: ExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const fichier = await this.exports.exporter(acteur, q);
    res.set({
      'Content-Type': fichier.typeMime,
      'Content-Disposition': `attachment; filename="${fichier.nomFichier}"`,
      'X-Nombre-Lignes': String(fichier.lignes),
    });
    return new StreamableFile(fichier.contenu);
  }
}
