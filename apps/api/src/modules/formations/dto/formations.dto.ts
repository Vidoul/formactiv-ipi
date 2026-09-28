import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Modalite, StatutFormation, TypeReferentiel } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Nettoyer } from '../../../common/utils/transformations';

export class ListeFormationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: StatutFormation })
  @IsOptional()
  @IsEnum(StatutFormation)
  statut?: StatutFormation;

  @ApiPropertyOptional({ enum: Modalite })
  @IsOptional()
  @IsEnum(Modalite)
  modalite?: Modalite;

  @ApiPropertyOptional()
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  recherche?: string;
}

export class CreationFormationDto {
  @ApiProperty({ example: 'Cybersécurité fondamentaux' })
  @Nettoyer()
  @IsString()
  @Length(2, 200)
  intitule!: string;

  @ApiProperty({ example: 35, description: 'Durée en heures (RG-FORM-01)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  dureeHeures!: number;

  @ApiProperty({ enum: Modalite })
  @IsEnum(Modalite)
  modalite!: Modalite;

  @ApiPropertyOptional({ example: 'Bases en informatique', description: '« Aucun » par défaut' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  prerequis?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Seuil d’acquisition sur 20 (RG-EVAL-02) ; paramètre plateforme par défaut',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  seuilAcquisition?: number;

  @ApiPropertyOptional({ type: [String], description: 'Compétences visées (RG-FORM-02)' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  competenceIds?: string[];
}

export class ModificationFormationDto extends PartialType(
  OmitType(CreationFormationDto, ['competenceIds'] as const),
) {
  @ApiPropertyOptional({
    enum: StatutFormation,
    description: 'Publication / archivage (RG-FORM-03)',
  })
  @IsOptional()
  @IsEnum(StatutFormation)
  statut?: StatutFormation;
}

export class AjoutCompetenceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  competenceId!: string;
}

export class CompetenceVisee {
  @ApiProperty() id!: string;
  @ApiProperty() libelle!: string;
  @ApiProperty({ enum: TypeReferentiel }) typeReferentiel!: TypeReferentiel;
  @ApiPropertyOptional({ nullable: true }) codeRncp!: string | null;
}

export class FormationResumeDto {
  @ApiProperty() id!: string;
  @ApiProperty() intitule!: string;
  @ApiProperty() dureeHeures!: number;
  @ApiProperty({ enum: Modalite }) modalite!: Modalite;
  @ApiProperty() prerequis!: string;
  @ApiProperty({ enum: StatutFormation }) statut!: StatutFormation;
  @ApiProperty() seuilAcquisition!: number;
  @ApiProperty() nombreCompetences!: number;
  @ApiProperty() nombreSessions!: number;
}

export class FormationDetailDto extends FormationResumeDto {
  @ApiProperty({ type: [CompetenceVisee] }) competences!: CompetenceVisee[];
  @ApiProperty() dateCreation!: Date;
  @ApiProperty() dateModification!: Date;
}
