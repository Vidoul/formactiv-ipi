import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Modalite, StatutInscription, TypeDocument } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { EstDateIso } from '../../../common/decorators/date-iso.decorator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Nettoyer } from '../../../common/utils/transformations';

// ------------------------------------------------------------------ Entrées

/** Filtres RG-DASH-03 : période, formation, entreprise (administration seulement). */
export class IndicateursQueryDto {
  @ApiPropertyOptional({
    example: '2026-07-01',
    description: 'Début de période (défaut : 1er janvier)',
  })
  @IsOptional()
  @EstDateIso()
  du?: string;

  @ApiPropertyOptional({
    example: '2026-09-30',
    description: 'Fin de période (défaut : 31 décembre)',
  })
  @IsOptional()
  @EstDateIso()
  au?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  formationId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Administration uniquement (RG-DASH-03)' })
  @IsOptional()
  @IsUUID()
  entrepriseId?: string;
}

export const ETATS_SALARIE = ['A_VENIR', 'EN_COURS', 'TERMINEE'] as const;
export type EtatSalarie = (typeof ETATS_SALARIE)[number];

export class SalariesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  formationId?: string;

  @ApiPropertyOptional({ enum: ETATS_SALARIE, description: 'Avancement temporel de la session' })
  @IsOptional()
  @IsIn(ETATS_SALARIE)
  etat?: EtatSalarie;
}

export class ReponseSatisfactionDto {
  @ApiProperty({ minimum: 1, maximum: 5, example: 4 })
  @Type(() => Number)
  @IsInt({ message: 'La note de satisfaction est un entier de 1 à 5.' })
  @Min(1, { message: 'La note de satisfaction est un entier de 1 à 5.' })
  @Max(5, { message: 'La note de satisfaction est un entier de 1 à 5.' })
  score!: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;

  @ApiProperty({
    description:
      'Consentement explicite à la finalité « questionnaires de satisfaction » (RG-RGPD-01), ' +
      'requis s’il n’a pas déjà été donné',
  })
  @IsBoolean()
  @Equals(true, { message: 'Votre accord est nécessaire pour enregistrer votre réponse.' })
  consentement!: boolean;
}

// ------------------------------------------------------------------ Sorties

class SatisfactionDto {
  @ApiPropertyOptional({ nullable: true, example: 4.2 }) moyenne!: number | null;
  @ApiProperty({ example: 128 }) reponses!: number;
}

class AgregatDto {
  @ApiProperty() inscriptions!: number;
  @ApiProperty() apprenants!: number;
  @ApiProperty() validees!: number;
  @ApiProperty() terminees!: number;
  @ApiProperty({ description: 'Certificats obtenus (RG-CERT-01)' }) certificats!: number;
  @ApiPropertyOptional({ nullable: true, description: 'Ratio 0..1' }) tauxCompletion!:
    number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Ratio 0..1' }) tauxReussite!: number | null;
  @ApiProperty({ type: SatisfactionDto }) satisfaction!: SatisfactionDto;
}

class ComparaisonDto {
  @ApiProperty() periode!: { du: string; au: string };
  @ApiPropertyOptional({ nullable: true, description: 'Écart en points' })
  tauxReussitePoints!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Écart en points' })
  tauxCompletionPoints!: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'Variation en %' })
  inscriptionsPourcent!: number | null;
}

class MoisDto {
  @ApiProperty({ example: '2026-09' }) mois!: string;
  @ApiProperty({ description: 'Inscriptions validées ou terminées' }) inscriptions!: number;
  @ApiProperty() apprenants!: number;
}

class TrimestreDto {
  @ApiProperty({ example: '2026-T3' }) trimestre!: string;
  @ApiProperty({ description: 'Inscriptions validées ou terminées' }) inscriptions!: number;
  @ApiProperty({ description: 'Apprenants distincts' }) apprenants!: number;
  @ApiProperty({ description: 'Trimestre non commencé (sessions planifiées)' })
  previsionnel!: boolean;
}

class FormationIndicateursDto extends AgregatDto {
  @ApiProperty() formation!: { id: string; intitule: string };
  @ApiPropertyOptional({ nullable: true, description: 'Part des inscriptions de la période' })
  part!: number | null;
}

export class IndicateursDto {
  @ApiProperty() periode!: { du: string; au: string };
  @ApiProperty({ type: AgregatDto }) indicateurs!: AgregatDto;
  @ApiProperty({ type: ComparaisonDto }) comparaison!: ComparaisonDto;
  @ApiProperty({ type: [MoisDto] }) parMois!: MoisDto[];
  @ApiProperty({ type: [TrimestreDto] }) parTrimestre!: TrimestreDto[];
  @ApiProperty({ type: [FormationIndicateursDto] }) parFormation!: FormationIndicateursDto[];
}

class ActionRecenteDto {
  @ApiProperty() id!: string;
  @ApiProperty() date!: Date;
  @ApiPropertyOptional({ nullable: true }) auteur!: { prenom: string; nom: string } | null;
  @ApiProperty() action!: string;
  @ApiPropertyOptional({ nullable: true }) typeObjet!: string | null;
  @ApiPropertyOptional({ nullable: true }) details!: string | null;
}

export class TableauAdministrationDto {
  @ApiProperty() comptesActifs!: number;
  @ApiProperty() connexions!: {
    total: number;
    variation: number | null;
    parJour: { jour: string; connexions: number }[];
  };
  @ApiProperty() demandesRgpd!: { enAttente: number; suppressions: number };
  @ApiProperty() comptesVerrouilles!: number;
  @ApiProperty({ type: [ActionRecenteDto] }) dernieresActions!: ActionRecenteDto[];
}

class SessionFormateurDto {
  @ApiProperty() sessionId!: string;
  @ApiProperty() intitule!: string;
  @ApiProperty() dateDebut!: string;
  @ApiProperty() dateFin!: string;
  @ApiProperty() apprenants!: number;
  @ApiPropertyOptional({ nullable: true, description: 'Part des compétences validées (0..1)' })
  partValidee!: number | null;
}

export class TableauFormateurDto {
  @ApiProperty() sessionsAVenir!: number;
  @ApiProperty() apprenantsSuivis!: number;
  @ApiPropertyOptional({ nullable: true, description: 'Sur les sessions terminées (0..1)' })
  acquisitionMoyenne!: number | null;
  @ApiProperty({ type: [SessionFormateurDto] }) parSession!: SessionFormateurDto[];
}

class ProgressionFormationDto {
  @ApiProperty() inscriptionId!: string;
  @ApiProperty() formation!: string;
  @ApiProperty({ enum: StatutInscription }) statut!: StatutInscription;
  @ApiProperty({ enum: ETATS_SALARIE }) etat!: EtatSalarie;
  @ApiProperty() competencesAcquises!: number;
  @ApiProperty() competencesVisees!: number;
  @ApiPropertyOptional({ enum: TypeDocument, nullable: true }) document!: TypeDocument | null;
}

class ProchaineSessionDto {
  @ApiProperty() inscriptionId!: string;
  @ApiProperty() formation!: string;
  @ApiProperty() dateDebut!: string;
  @ApiProperty() dateFin!: string;
  @ApiProperty({ enum: Modalite }) modalite!: Modalite;
  @ApiPropertyOptional({ nullable: true }) lieu!: string | null;
}

export class TableauApprenantDto {
  @ApiProperty() formationsSuivies!: number;
  @ApiProperty() competences!: { acquises: number; total: number };
  @ApiProperty() documents!: { total: number; certificats: number; attestations: number };
  @ApiProperty({ type: [ProgressionFormationDto] }) progression!: ProgressionFormationDto[];
  @ApiProperty({ type: [ProchaineSessionDto] }) prochainesSessions!: ProchaineSessionDto[];
  @ApiProperty({ description: 'Inscriptions terminées sans réponse (RG-DASH-04)' })
  satisfactionAttendue!: { inscriptionId: string; formation: string }[];
  @ApiProperty({ description: 'Consentement « questionnaires de satisfaction » actif' })
  consentementSatisfaction!: boolean;
}

class LigneSalarieDto {
  @ApiProperty() inscriptionId!: string;
  @ApiProperty() apprenant!: { id: string; nom: string; prenom: string };
  @ApiProperty() formation!: { id: string; intitule: string };
  @ApiProperty() session!: { dateDebut: string; dateFin: string };
  @ApiProperty({ enum: StatutInscription }) statut!: StatutInscription;
  @ApiProperty({ enum: ETATS_SALARIE }) etat!: EtatSalarie;
  @ApiProperty() competencesAcquises!: number;
  @ApiProperty() competencesVisees!: number;
  @ApiProperty({ enum: TypeDocument, isArray: true }) documents!: TypeDocument[];
}

export class PageSalariesDto {
  @ApiProperty({ type: [LigneSalarieDto] }) donnees!: LigneSalarieDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() limit!: number;
  @ApiProperty({ description: 'Salariés distincts correspondant aux filtres' }) salaries!: number;
}

export class SatisfactionEnregistreeDto {
  @ApiProperty() id!: string;
  @ApiProperty() score!: number;
  @ApiProperty() dateReponse!: Date;
}
