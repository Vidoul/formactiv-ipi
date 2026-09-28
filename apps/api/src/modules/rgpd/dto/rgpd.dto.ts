import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CodeRole,
  FinaliteConsentement,
  StatutCompte,
  StatutDemandeRgpd,
  TypeDemandeRgpd,
} from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { Nettoyer } from '../../../common/utils/transformations';

// ------------------------------------------------------------------ Entrées (UC-13)

/** Rectification en libre-service (RG-RGPD-02) : l'email se modifie par demande. */
export class RectificationDto {
  @ApiPropertyOptional({ example: 'Martin' })
  @IsOptional()
  @Nettoyer()
  @IsString()
  @Length(1, 100)
  nom?: string;

  @ApiPropertyOptional({ example: 'Léa' })
  @IsOptional()
  @Nettoyer()
  @IsString()
  @Length(1, 100)
  prenom?: string;
}

export class CreationDemandeDto {
  @ApiProperty({ enum: TypeDemandeRgpd })
  @IsEnum(TypeDemandeRgpd)
  type!: TypeDemandeRgpd;

  @ApiPropertyOptional({ maxLength: 1000, description: 'Précisions (ex. donnée à rectifier)' })
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(1000)
  message?: string;
}

// ------------------------------------------------------------------ Entrées (UC-14)

/** Filtre « ouvertes » : reçues ou en cours (vue par défaut de l'écran 07). */
export const FILTRES_STATUT = ['OUVERTES', ...Object.values(StatutDemandeRgpd)] as const;
export type FiltreStatut = (typeof FILTRES_STATUT)[number];

export class ListeDemandesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TypeDemandeRgpd })
  @IsOptional()
  @IsEnum(TypeDemandeRgpd)
  type?: TypeDemandeRgpd;

  @ApiPropertyOptional({ enum: FILTRES_STATUT, description: 'OUVERTES = reçues ou en cours' })
  @IsOptional()
  @IsIn(FILTRES_STATUT)
  statut?: FiltreStatut;
}

export class TraitementDemandeDto {
  @ApiProperty({
    enum: [StatutDemandeRgpd.EN_COURS, StatutDemandeRgpd.TRAITEE, StatutDemandeRgpd.REFUSEE],
  })
  @IsIn([StatutDemandeRgpd.EN_COURS, StatutDemandeRgpd.TRAITEE, StatutDemandeRgpd.REFUSEE])
  statut!: StatutDemandeRgpd;

  @ApiPropertyOptional({ maxLength: 1000, description: 'Compte rendu ou motif de refus' })
  @IsOptional()
  @Nettoyer()
  @IsString()
  @MaxLength(1000)
  reponse?: string;
}

// ------------------------------------------------------------------ Sorties

class CompteDto {
  @ApiProperty() id!: string;
  @ApiProperty() nom!: string;
  @ApiProperty() prenom!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: CodeRole }) role!: CodeRole;
  @ApiProperty({ enum: StatutCompte }) statutCompte!: StatutCompte;
  @ApiPropertyOptional({ nullable: true }) entreprise!: { raisonSociale: string } | null;
  @ApiProperty() mfaActive!: boolean;
  @ApiProperty() dateCreation!: Date;
  @ApiPropertyOptional({ nullable: true }) dateDerniereConnexion!: Date | null;
}

class ConsentementDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: FinaliteConsentement }) finalite!: FinaliteConsentement;
  @ApiProperty() versionMentions!: string;
  @ApiProperty() dateConsentement!: Date;
  @ApiPropertyOptional({ nullable: true }) dateRetrait!: Date | null;
}

export class DemandeDto {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'D-126' }) numero!: string;
  @ApiProperty({ enum: TypeDemandeRgpd }) type!: TypeDemandeRgpd;
  @ApiProperty({ enum: StatutDemandeRgpd }) statut!: StatutDemandeRgpd;
  @ApiPropertyOptional({ nullable: true }) message!: string | null;
  @ApiPropertyOptional({ nullable: true }) reponse!: string | null;
  @ApiProperty() dateDemande!: Date;
  @ApiPropertyOptional({ nullable: true }) dateTraitement!: Date | null;
}

export class DemandeAdministrationDto extends DemandeDto {
  @ApiProperty() demandeur!: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
    statutCompte: StatutCompte;
  };
  @ApiPropertyOptional({ nullable: true }) traitant!: { nom: string; prenom: string } | null;
}

/** Droit d'accès (UC-13) : ensemble des données personnelles de l'utilisateur. */
export class MesDonneesDto {
  @ApiProperty({ type: CompteDto }) compte!: CompteDto;
  @ApiProperty({ type: [ConsentementDto] }) consentements!: ConsentementDto[];
  @ApiProperty() inscriptions!: {
    formation: string;
    dateDebut: string;
    dateFin: string;
    statut: string;
    dateInscription: Date;
  }[];
  @ApiProperty() evaluations!: {
    formation: string;
    competence: string;
    note: number;
    acquise: boolean;
    dateSaisie: Date;
  }[];
  @ApiProperty() documents!: { type: string; reference: string; dateGeneration: Date }[];
  @ApiProperty() satisfaction!: {
    formation: string;
    score: number;
    commentaire: string | null;
    dateReponse: Date;
  }[];
  @ApiProperty({ type: [DemandeDto] }) demandes!: DemandeDto[];
}

export class RapportConservationDto {
  @ApiProperty() comptesAnonymises!: number;
  @ApiProperty() entreesJournalPurgees!: number;
  @ApiProperty() reponsesSatisfactionAnonymisees!: number;
  @ApiProperty() fichiersOrphelinsSupprimes!: number;
}
