import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CodeRole, StatutCompte } from '@prisma/client';
import {
  Equals,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Nettoyer, NormaliserEmail } from '../../../common/utils/transformations';

export class ListeUtilisateursQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: CodeRole })
  @IsOptional()
  @IsEnum(CodeRole)
  role?: CodeRole;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  entrepriseId?: string;

  @ApiPropertyOptional({ enum: StatutCompte })
  @IsOptional()
  @IsEnum(StatutCompte)
  statut?: StatutCompte;

  @ApiPropertyOptional({ description: 'Recherche sur le nom, le prénom ou l’email' })
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(100)
  recherche?: string;
}

export class CreationUtilisateurDto {
  @ApiProperty({ example: 'Martin' })
  @Nettoyer()
  @IsString()
  @Length(1, 100)
  nom!: string;

  @ApiProperty({ example: 'Léa' })
  @Nettoyer()
  @IsString()
  @Length(1, 100)
  prenom!: string;

  @ApiProperty({ example: 'lea.martin@mail.fr' })
  @NormaliserEmail()
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({ enum: CodeRole, description: 'Rôle unique du compte (RG-CPT-01)' })
  @IsEnum(CodeRole)
  role!: CodeRole;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID()
  entrepriseId?: string | null;
}

export class ModificationUtilisateurDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Nettoyer()
  @IsString()
  @Length(1, 100)
  nom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Nettoyer()
  @IsString()
  @Length(1, 100)
  prenom?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @NormaliserEmail()
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ enum: CodeRole })
  @IsOptional()
  @IsEnum(CodeRole)
  role?: CodeRole;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsUUID()
  entrepriseId?: string | null;

  @ApiPropertyOptional({
    enum: [StatutCompte.ACTIF, StatutCompte.DESACTIVE],
    description: 'ACTIF déverrouille ou réactive le compte ; DESACTIVE ferme ses sessions.',
  })
  @IsOptional()
  @IsIn([StatutCompte.ACTIF, StatutCompte.DESACTIVE])
  statut?: 'ACTIF' | 'DESACTIVE';

  @ApiPropertyOptional({
    description: 'false réinitialise la double authentification (perte du téléphone).',
  })
  @IsOptional()
  @Equals(false)
  mfaActive?: false;
}

export class UtilisateurResumeDto {
  @ApiProperty() id!: string;
  @ApiProperty() nom!: string;
  @ApiProperty() prenom!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: CodeRole }) role!: CodeRole;
  @ApiProperty({ enum: StatutCompte }) statut!: StatutCompte;
  @ApiPropertyOptional({ nullable: true }) entreprise!: {
    id: string;
    raisonSociale: string;
  } | null;
}

export class UtilisateurDetailDto extends UtilisateurResumeDto {
  @ApiProperty() mfaActive!: boolean;
  @ApiProperty({ description: 'Faux tant que le compte n’a pas été activé par son titulaire.' })
  active!: boolean;
  @ApiPropertyOptional({ nullable: true }) verrouilleJusquA!: Date | null;
  @ApiPropertyOptional({ nullable: true }) dateDerniereConnexion!: Date | null;
  @ApiProperty() dateCreation!: Date;
}

export class PageUtilisateursDto {
  @ApiProperty({ type: [UtilisateurResumeDto] }) donnees!: UtilisateurResumeDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
}

export class ResultatSuppressionDto {
  @ApiProperty({ enum: ['SUPPRIME', 'ANONYMISE'], description: 'RG-CPT-02' })
  resultat!: 'SUPPRIME' | 'ANONYMISE';
}
