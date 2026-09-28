import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatutInscription, TypeDocument, TypeReferentiel } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';

// ------------------------------------------------------------------ Entrées

export class GenerationDocumentDto {
  @ApiProperty({ enum: TypeDocument, description: 'RG-CERT-01' })
  @IsEnum(TypeDocument)
  type!: TypeDocument;
}

export class ListeDocumentsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  apprenantId?: string;

  @ApiPropertyOptional({ enum: TypeDocument })
  @IsOptional()
  @IsEnum(TypeDocument)
  type?: TypeDocument;
}

/** Paramètres de l'URL signée de téléchargement (ADR-05). */
export class TelechargementQueryDto {
  @ApiProperty({ description: 'Expiration (secondes depuis l’époque Unix)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expire!: number;

  @ApiProperty({ format: 'uuid', description: 'Utilisateur ayant obtenu le lien' })
  @IsUUID()
  u!: string;

  @ApiProperty({ description: 'Signature HMAC-SHA256 (base64url)' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  signature!: string;
}

// ------------------------------------------------------------------ Sorties

class PersonneDocument {
  @ApiProperty() id!: string;
  @ApiProperty() nom!: string;
  @ApiProperty() prenom!: string;
}

class FormationDocument {
  @ApiProperty() id!: string;
  @ApiProperty() intitule!: string;
}

class SessionDocument {
  @ApiProperty() id!: string;
  @ApiProperty({ example: '2026-09-14' }) dateDebut!: string;
  @ApiProperty({ example: '2026-09-18' }) dateFin!: string;
}

export class DocumentDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: TypeDocument }) type!: TypeDocument;
  @ApiProperty({ example: 'C-2026-0412' }) reference!: string;
  @ApiProperty() dateGeneration!: Date;
  @ApiProperty() inscriptionId!: string;
  @ApiProperty({ type: PersonneDocument }) apprenant!: PersonneDocument;
  @ApiProperty({ type: FormationDocument }) formation!: FormationDocument;
  @ApiProperty({ type: SessionDocument }) session!: SessionDocument;
  @ApiProperty({ description: 'Émetteur (RG-CERT-02)' }) emetteur!: {
    nom: string;
    prenom: string;
  };
}

export class LienTelechargementDto {
  @ApiProperty({
    description: 'URL relative signée, valable quelques minutes',
    example: '/api/v1/documents/…/fichier?expire=…&u=…&signature=…',
  })
  url!: string;
  @ApiProperty() expireLe!: Date;
  @ApiProperty({ example: 'formactiv-C-2026-0412.pdf' }) nomFichier!: string;
}

class DocumentResume {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: TypeDocument }) type!: TypeDocument;
  @ApiProperty() reference!: string;
  @ApiProperty() dateGeneration!: Date;
}

class LigneBilanDocuments {
  @ApiProperty() inscriptionId!: string;
  @ApiProperty({ enum: StatutInscription }) statut!: StatutInscription;
  @ApiProperty({ type: PersonneDocument }) apprenant!: PersonneDocument;
  @ApiProperty({ example: 4 }) competencesAcquises!: number;
  @ApiProperty({ example: 4 }) competencesVisees!: number;
  @ApiProperty({ enum: TypeDocument, isArray: true }) typesGenerables!: TypeDocument[];
  @ApiPropertyOptional({ enum: TypeDocument, nullable: true, description: 'UC-09 A1' })
  documentPropose!: TypeDocument | null;
  @ApiProperty({ type: [DocumentResume] }) documents!: DocumentResume[];
}

/** Écran 14 : génération des documents d'une session. */
export class BilanDocumentsSessionDto {
  @ApiProperty() session!: {
    id: string;
    dateDebut: string;
    dateFin: string;
    terminee: boolean;
    formation: { id: string; intitule: string };
  };
  @ApiProperty() peutGenerer!: boolean;
  @ApiProperty({ type: [LigneBilanDocuments] }) lignes!: LigneBilanDocuments[];
}

// ------------------------------------------------------------------ Parcours (RG-HIST-01)

class EvaluationParcours {
  @ApiProperty() competenceId!: string;
  @ApiProperty() libelle!: string;
  @ApiPropertyOptional({ nullable: true }) note!: number | null;
  @ApiProperty() acquise!: boolean;
  @ApiPropertyOptional({ nullable: true }) dateSaisie!: Date | null;
}

class EtapeParcours {
  @ApiProperty() inscriptionId!: string;
  @ApiProperty({ enum: StatutInscription }) statut!: StatutInscription;
  @ApiProperty() dateInscription!: Date;
  @ApiProperty() formation!: { id: string; intitule: string; dureeHeures: number };
  @ApiProperty() session!: {
    id: string;
    dateDebut: string;
    dateFin: string;
    lieu: string | null;
    enCours: boolean;
  };
  @ApiPropertyOptional({ nullable: true, description: 'Moyenne des notes saisies' })
  moyenne!: number | null;
  @ApiProperty({ description: 'Toutes les compétences ne sont pas encore évaluées' })
  partielle!: boolean;
  @ApiProperty() competencesAcquises!: number;
  @ApiProperty() competencesVisees!: number;
  @ApiProperty({ type: [EvaluationParcours] }) evaluations!: EvaluationParcours[];
  @ApiProperty({ type: [DocumentResume] }) documents!: DocumentResume[];
}

class CompetenceParcours {
  @ApiProperty() id!: string;
  @ApiProperty() libelle!: string;
  @ApiProperty({ enum: TypeReferentiel }) typeReferentiel!: TypeReferentiel;
  @ApiPropertyOptional({ nullable: true }) codeRncp!: string | null;
  @ApiPropertyOptional({ nullable: true }) meilleureNote!: number | null;
  @ApiProperty() acquise!: boolean;
  @ApiProperty({ description: 'Progression vers le seuil d’acquisition (0 à 100)' })
  progression!: number;
}

export class ParcoursDto {
  @ApiProperty({ type: PersonneDocument }) apprenant!: PersonneDocument;
  @ApiProperty({ type: [EtapeParcours] }) etapes!: EtapeParcours[];
  @ApiProperty({ type: [CompetenceParcours] }) competences!: CompetenceParcours[];
}
