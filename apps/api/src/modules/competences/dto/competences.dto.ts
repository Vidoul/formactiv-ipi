import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TypeReferentiel } from '@prisma/client';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Nettoyer } from '../../../common/utils/transformations';

export class ListeCompetencesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TypeReferentiel })
  @IsOptional()
  @IsEnum(TypeReferentiel)
  referentiel?: TypeReferentiel;

  @ApiPropertyOptional({ description: 'Mot-clé sur le libellé ou le code RNCP' })
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  recherche?: string;
}

export class CreationCompetenceDto {
  @ApiProperty({ example: 'Écrire des requêtes SQL' })
  @Nettoyer()
  @IsString()
  @Length(2, 200)
  libelle!: string;

  @ApiProperty({ enum: TypeReferentiel })
  @IsEnum(TypeReferentiel)
  typeReferentiel!: TypeReferentiel;

  @ApiPropertyOptional({
    example: 'RNCP36125-C2',
    description: 'Obligatoire pour le référentiel RNCP (RG-COMP-01).',
  })
  @ValidateIf(
    (o: CreationCompetenceDto) => o.typeReferentiel === TypeReferentiel.RNCP || !!o.codeRncp,
  )
  @Nettoyer()
  @Matches(/^RNCP\d{3,6}(-[A-Z]{1,3}\d{1,3})?$/, {
    message: 'Le code RNCP doit avoir la forme RNCP36125 ou RNCP36125-C2.',
  })
  codeRncp?: string | null;
}

export class ModificationCompetenceDto extends PartialType(CreationCompetenceDto) {}

export class CompetenceDto {
  @ApiProperty() id!: string;
  @ApiProperty() libelle!: string;
  @ApiProperty({ enum: TypeReferentiel }) typeReferentiel!: TypeReferentiel;
  @ApiPropertyOptional({ nullable: true }) codeRncp!: string | null;
  @ApiProperty({ description: 'Nombre de formations qui visent cette compétence' })
  nombreFormations!: number;
}
