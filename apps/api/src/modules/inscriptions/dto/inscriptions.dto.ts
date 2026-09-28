import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutInscription } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

export class ListeInscriptionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ enum: StatutInscription })
  @IsOptional()
  @IsEnum(StatutInscription)
  statut?: StatutInscription;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  entrepriseId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  apprenantId?: string;
}

export class CreationInscriptionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  apprenantId!: string;
}

export class ModificationInscriptionDto {
  @ApiPropertyOptional({ enum: StatutInscription, description: 'Cycle RG-INSC-02' })
  @IsOptional()
  @IsEnum(StatutInscription)
  statut?: StatutInscription;

  @ApiPropertyOptional({
    description: 'Confirme que les prérequis de la formation sont acquis (RG-INSC-03)',
  })
  @IsOptional()
  @IsBoolean()
  prerequisVerifies?: boolean;
}

class ApprenantInscrit {
  @ApiProperty() id!: string;
  @ApiProperty() nom!: string;
  @ApiProperty() prenom!: string;
  @ApiPropertyOptional({ description: 'Visible de l’administration uniquement (minimisation)' })
  email?: string;
  @ApiPropertyOptional({ nullable: true }) entreprise!: {
    id: string;
    raisonSociale: string;
  } | null;
}

class SessionInscrite {
  @ApiProperty() id!: string;
  @ApiProperty() dateDebut!: string;
  @ApiProperty() dateFin!: string;
  @ApiPropertyOptional({ nullable: true }) lieu!: string | null;
  @ApiProperty() formation!: { id: string; intitule: string };
}

export class InscriptionDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: StatutInscription }) statut!: StatutInscription;
  @ApiProperty() dateInscription!: Date;
  @ApiProperty({ description: 'La formation comporte des prérequis' }) prerequisRequis!: boolean;
  @ApiProperty() prerequisVerifies!: boolean;
  @ApiProperty({ type: ApprenantInscrit }) apprenant!: ApprenantInscrit;
  @ApiProperty({ type: SessionInscrite }) session!: SessionInscrite;
}

export class ResultatInscriptionDto {
  @ApiProperty({ type: InscriptionDto }) inscription!: InscriptionDto;
  @ApiProperty({
    type: [String],
    description: 'Avertissements non bloquants (ex. PREREQUIS_A_VERIFIER, RG-INSC-03)',
  })
  avertissements!: string[];
}
