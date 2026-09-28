import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Modalite, StatutFormation } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Nettoyer } from '../../../common/utils/transformations';

const DATE_ISO = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const MESSAGE_DATE = 'Date attendue au format AAAA-MM-JJ.';

export class ListeSessionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  formationId?: string;

  @ApiPropertyOptional({ enum: ['a_venir', 'en_cours', 'passees'] })
  @IsOptional()
  @IsIn(['a_venir', 'en_cours', 'passees'])
  periode?: 'a_venir' | 'en_cours' | 'passees';

  @ApiPropertyOptional({ description: 'Sessions se déroulant après cette date (AAAA-MM-JJ)' })
  @IsOptional()
  @Matches(DATE_ISO, { message: MESSAGE_DATE })
  depuis?: string;

  @ApiPropertyOptional({ description: 'Sessions se déroulant avant cette date (AAAA-MM-JJ)' })
  @IsOptional()
  @Matches(DATE_ISO, { message: MESSAGE_DATE })
  jusqua?: string;
}

export class CreationSessionDto {
  @ApiProperty({ format: 'uuid', description: 'Formation publiée (précondition UC-05)' })
  @IsUUID()
  formationId!: string;

  @ApiProperty({ example: '2026-09-14' })
  @Matches(DATE_ISO, { message: MESSAGE_DATE })
  dateDebut!: string;

  @ApiProperty({ example: '2026-09-18', description: 'Postérieure ou égale au début (RG-SESS-01)' })
  @Matches(DATE_ISO, { message: MESSAGE_DATE })
  dateFin!: string;

  @ApiPropertyOptional({ example: 12, nullable: true, description: 'RG-SESS-03 ([À VALIDER])' })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  capaciteMax?: number | null;

  @ApiPropertyOptional({ example: 'Toulouse' })
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(150)
  lieu?: string;

  @ApiPropertyOptional({ type: [String], description: 'Formateurs affectés (RG-SESS-02)' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10)
  @IsUUID('all', { each: true })
  formateurIds?: string[];
}

export class ModificationSessionDto extends PartialType(
  OmitType(CreationSessionDto, ['formationId', 'formateurIds'] as const),
) {}

export class PeriodeQueryDto {
  @ApiProperty({ example: '2026-09-14' })
  @Matches(DATE_ISO, { message: MESSAGE_DATE })
  debut!: string;

  @ApiProperty({ example: '2026-09-18' })
  @Matches(DATE_ISO, { message: MESSAGE_DATE })
  fin!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Session à ignorer (modification)' })
  @IsOptional()
  @IsUUID()
  sessionExclue?: string;
}

// ------------------------------------------------------------------ Sorties

class FormationDeSession {
  @ApiProperty() id!: string;
  @ApiProperty() intitule!: string;
  @ApiProperty({ enum: Modalite }) modalite!: Modalite;
  @ApiProperty({ enum: StatutFormation }) statut!: StatutFormation;
}

export class ConflitDto {
  @ApiProperty() sessionId!: string;
  @ApiProperty() formation!: string;
  @ApiProperty({ description: 'Premier jour commun (AAAA-MM-JJ)' }) premierJour!: string;
}

export class FormateurAffecteDto {
  @ApiProperty() id!: string;
  @ApiProperty() nom!: string;
  @ApiProperty() prenom!: string;
  @ApiProperty({ type: [ConflitDto] }) conflits!: ConflitDto[];
}

export class SessionDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: FormationDeSession }) formation!: FormationDeSession;
  @ApiProperty() dateDebut!: string;
  @ApiProperty() dateFin!: string;
  @ApiPropertyOptional({ nullable: true }) lieu!: string | null;
  @ApiPropertyOptional({ nullable: true }) capaciteMax!: number | null;
  @ApiProperty({ enum: ['A_VENIR', 'EN_COURS', 'TERMINEE'] }) statutTemporel!: string;
  @ApiProperty({ description: 'Inscriptions en attente, validées ou terminées' })
  nombreInscrits!: number;
  @ApiProperty({ description: 'Inscriptions occupant une place (RG-SESS-03)' })
  placesOccupees!: number;
  @ApiProperty({ type: [FormateurAffecteDto] }) formateurs!: FormateurAffecteDto[];
  @ApiProperty({ description: 'Sans formateur à l’approche du début (RG-SESS-02)' })
  alerteSansFormateur!: boolean;
  @ApiProperty({ description: 'Notes attendues non saisies (UC-08)' }) notesManquantes!: number;
}

export class DisponibiliteFormateurDto {
  @ApiProperty() id!: string;
  @ApiProperty() nom!: string;
  @ApiProperty() prenom!: string;
  @ApiProperty({ type: [ConflitDto] }) conflits!: ConflitDto[];
}
