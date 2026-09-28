import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { DATE_ISO, MESSAGE_DATE } from '../../../common/utils/dates';

export const JEUX_EXPORT = ['inscriptions', 'resultats', 'evaluations'] as const;
export type JeuExport = (typeof JEUX_EXPORT)[number];

export const FORMATS_EXPORT = ['csv', 'pdf'] as const;
export type FormatExport = (typeof FORMATS_EXPORT)[number];

/** UC-11 : choix du périmètre et du format (RG-EXP-01, filtres RG-DASH-03). */
export class ExportQueryDto {
  @ApiProperty({
    enum: JEUX_EXPORT,
    description:
      'inscriptions : liste des inscrits ; resultats : synthèse par apprenant ; ' +
      'evaluations : détail des notes par compétence',
  })
  @IsIn(JEUX_EXPORT)
  jeu!: JeuExport;

  @ApiProperty({ enum: FORMATS_EXPORT })
  @IsIn(FORMATS_EXPORT)
  format!: FormatExport;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  formationId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Réservé à l’administrateur et au responsable formation (RG-DASH-03)',
  })
  @IsOptional()
  @IsUUID()
  entrepriseId?: string;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Sessions se terminant à partir de' })
  @IsOptional()
  @Matches(DATE_ISO, { message: MESSAGE_DATE })
  du?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Sessions commençant jusqu’au' })
  @IsOptional()
  @Matches(DATE_ISO, { message: MESSAGE_DATE })
  au?: string;
}
