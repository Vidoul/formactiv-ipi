import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Validate,
  ValidateIf,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Nettoyer, NormaliserEmail } from '../../../common/utils/transformations';
import { siretValide } from '../siret';

@ValidatorConstraint({ name: 'siret' })
class ContrainteSiret implements ValidatorConstraintInterface {
  validate(valeur: unknown): boolean {
    return typeof valeur === 'string' && siretValide(valeur);
  }
  defaultMessage(): string {
    return 'Le SIRET doit comporter 14 chiffres valides.';
  }
}

export class ListeEntreprisesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  recherche?: string;
}

export class CreationEntrepriseDto {
  @ApiProperty({ example: 'Groupe Oxalys' })
  @Nettoyer()
  @IsString()
  @Length(1, 150)
  raisonSociale!: string;

  @ApiPropertyOptional({ example: '81234567800013', nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null && v !== '')
  @Nettoyer()
  @Validate(ContrainteSiret)
  siret?: string | null;

  @ApiProperty({ example: 'formation@oxalys.fr' })
  @NormaliserEmail()
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(255)
  emailContact!: string;
}

export class ModificationEntrepriseDto extends PartialType(CreationEntrepriseDto) {}

export class EntrepriseDto {
  @ApiProperty() id!: string;
  @ApiProperty() raisonSociale!: string;
  @ApiPropertyOptional({ nullable: true }) siret!: string | null;
  @ApiProperty() emailContact!: string;
  @ApiProperty({ description: 'Nombre de comptes rattachés (salariés et représentants)' })
  nombreComptes!: number;
  @ApiProperty() dateCreation!: Date;
}
