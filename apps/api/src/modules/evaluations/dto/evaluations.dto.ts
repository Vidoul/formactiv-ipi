import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutInscription, TypeReferentiel } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNumber, IsUUID, Max, Min, ValidateNested } from 'class-validator';

const MESSAGE_NOTE = 'La note doit être comprise entre 0 et 20.';

export class SaisieNoteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  competenceId!: string;

  @ApiProperty({ example: 14.5, minimum: 0, maximum: 20 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: MESSAGE_NOTE })
  @Min(0, { message: MESSAGE_NOTE })
  @Max(20, { message: MESSAGE_NOTE })
  note!: number;
}

export class CorrectionNoteDto {
  @ApiProperty({ example: 12, minimum: 0, maximum: 20 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: MESSAGE_NOTE })
  @Min(0, { message: MESSAGE_NOTE })
  @Max(20, { message: MESSAGE_NOTE })
  note!: number;
}

export class NoteDeFeuilleDto extends SaisieNoteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  inscriptionId!: string;
}

export class SaisieFeuilleDto {
  @ApiProperty({ type: [NoteDeFeuilleDto] })
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => NoteDeFeuilleDto)
  notes!: NoteDeFeuilleDto[];
}

// ------------------------------------------------------------------ Sorties

class CompetenceEvaluee {
  @ApiProperty() id!: string;
  @ApiProperty() libelle!: string;
  @ApiProperty({ enum: TypeReferentiel }) typeReferentiel!: TypeReferentiel;
}

export class EvaluationDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: CompetenceEvaluee }) competence!: CompetenceEvaluee;
  @ApiPropertyOptional({
    nullable: true,
    description: 'Masquée pour le client entreprise (synthèse seulement, [À VALIDER])',
  })
  note!: number | null;
  @ApiProperty() acquise!: boolean;
  @ApiProperty() dateSaisie!: Date;
  @ApiPropertyOptional({ nullable: true }) formateur!: {
    id: string;
    nom: string;
    prenom: string;
  } | null;
}

class CelluleFeuille {
  @ApiProperty() evaluationId!: string;
  @ApiProperty() note!: number;
  @ApiProperty() acquise!: boolean;
}

class LigneFeuille {
  @ApiProperty() inscriptionId!: string;
  @ApiProperty({ enum: StatutInscription }) statut!: StatutInscription;
  @ApiProperty() apprenant!: { id: string; nom: string; prenom: string };
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'Notes indexées par identifiant de compétence : { evaluationId, note, acquise } ou null',
  })
  notes!: Record<string, CelluleFeuille | null>;
  @ApiProperty() acquises!: number;
  @ApiProperty() total!: number;
}

export class FeuilleEvaluationDto {
  @ApiProperty() session!: {
    id: string;
    dateDebut: string;
    dateFin: string;
    formation: { id: string; intitule: string; seuilAcquisition: number };
  };
  @ApiProperty({ type: [CompetenceEvaluee] }) competences!: CompetenceEvaluee[];
  @ApiProperty({ type: [LigneFeuille] }) lignes!: LigneFeuille[];
  @ApiProperty({ description: 'L’utilisateur peut saisir ou corriger (formateur affecté)' })
  modifiable!: boolean;
}
