import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Nettoyer } from '../../../common/utils/transformations';

export class JournalQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Nom, prénom ou email de l’auteur ; « système » possible' })
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  utilisateur?: string;

  @ApiPropertyOptional({ example: 'CHANGEMENT_ROLE' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  action?: string;

  @ApiPropertyOptional({ enum: [7, 30, 90, 365], description: 'Profondeur en jours' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsIn([7, 30, 90, 365])
  jours?: number;
}

export class EntreeJournalDto {
  @ApiProperty() id!: string;
  @ApiProperty() date!: Date;
  @ApiPropertyOptional({ nullable: true }) utilisateur!: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
  } | null;
  @ApiProperty() action!: string;
  @ApiPropertyOptional({ nullable: true }) typeObjet!: string | null;
  @ApiPropertyOptional({ nullable: true }) idObjet!: string | null;
  @ApiPropertyOptional({ nullable: true }) details!: string | null;
  @ApiPropertyOptional({ nullable: true }) adresseIp!: string | null;
}

export class PageJournalDto {
  @ApiProperty({ type: [EntreeJournalDto] }) donnees!: EntreeJournalDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}
