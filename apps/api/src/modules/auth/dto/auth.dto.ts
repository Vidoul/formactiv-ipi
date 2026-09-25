import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LONGUEUR_MAX } from '../regles/politique-mot-de-passe';

// ------------------------------------------------------------------ Entrées

export class ConnexionDto {
  @ApiProperty({ example: 'nadia.rey@formactiv.fr' })
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(255)
  email!: string;

  @ApiProperty({ format: 'password' })
  @IsString()
  @MinLength(1, { message: 'Le mot de passe est obligatoire.' })
  @MaxLength(LONGUEUR_MAX)
  motDePasse!: string;
}

export class VerificationMfaDto {
  @ApiProperty({ description: 'Jeton intermédiaire reçu à l’étape de connexion (5 min).' })
  @IsString()
  @MaxLength(2048)
  jetonMfa!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'Le code doit comporter 6 chiffres.' })
  code!: string;
}

export class MotDePasseOublieDto {
  @ApiProperty({ example: 'lea.martin@mail.fr' })
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(255)
  email!: string;
}

export class ReinitialisationDto {
  @ApiProperty({ description: 'Jeton à usage unique reçu par email (30 min).' })
  @IsString()
  @Length(43, 43, { message: 'Lien invalide.' })
  jeton!: string;

  @ApiProperty({ format: 'password', description: 'Nouveau mot de passe conforme à RG-AUTH-01.' })
  @IsString()
  @MaxLength(LONGUEUR_MAX)
  motDePasse!: string;
}

export class ActivationDto extends ReinitialisationDto {
  @ApiProperty({
    description: 'Consentement au traitement des données pour la gestion du compte (obligatoire).',
  })
  @IsBoolean()
  @Equals(true, { message: 'Ce consentement est nécessaire pour utiliser la plateforme.' })
  consentementGestionCompte!: boolean;

  @ApiProperty({ description: 'Consentement optionnel aux questionnaires de satisfaction.' })
  @IsBoolean()
  consentementSatisfaction!: boolean;
}

export class ChangementMotDePasseDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @MaxLength(LONGUEUR_MAX)
  motDePasseActuel!: string;

  @ApiProperty({ format: 'password' })
  @IsString()
  @MaxLength(LONGUEUR_MAX)
  nouveauMotDePasse!: string;
}

export class CodeMfaDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'Le code doit comporter 6 chiffres.' })
  code!: string;
}

export class DesactivationMfaDto extends CodeMfaDto {
  @ApiProperty({ format: 'password' })
  @IsString()
  @MaxLength(LONGUEUR_MAX)
  motDePasse!: string;
}

// ------------------------------------------------------------------ Sorties (documentation)

class EntrepriseResumeDto {
  @ApiProperty() id!: string;
  @ApiProperty() raisonSociale!: string;
}

export class ProfilDto {
  @ApiProperty() id!: string;
  @ApiProperty() nom!: string;
  @ApiProperty() prenom!: string;
  @ApiProperty() email!: string;
  @ApiProperty({ enum: ['ADMIN', 'RESP_FORMATION', 'FORMATEUR', 'APPRENANT', 'CLIENT_ENTREPRISE'] })
  role!: string;
  @ApiProperty() mfaActive!: boolean;
  @ApiProperty({ description: 'MFA obligatoire pour le rôle mais non configurée (RG-AUTH-03).' })
  mfaEnrolementRequis!: boolean;
  @ApiPropertyOptional({ type: EntrepriseResumeDto, nullable: true })
  entreprise!: EntrepriseResumeDto | null;
}

export class SessionDto {
  @ApiProperty({ description: 'Access token JWT (Bearer) — 15 minutes.' })
  accessToken!: string;
  @ApiProperty({ example: 900 }) expireDans!: number;
  @ApiProperty({ type: ProfilDto }) utilisateur!: ProfilDto;
}

export class ReponseConnexionDto {
  @ApiProperty({ description: 'Vrai si un code de double authentification est attendu.' })
  mfaRequis!: boolean;
  @ApiPropertyOptional({ description: 'Présent si mfaRequis : à renvoyer sur POST /auth/mfa.' })
  jetonMfa?: string;
  @ApiPropertyOptional() accessToken?: string;
  @ApiPropertyOptional() expireDans?: number;
  @ApiPropertyOptional({ type: ProfilDto }) utilisateur?: ProfilDto;
}

export class EnrolementMfaDto {
  @ApiProperty({ description: 'Secret base32 pour une saisie manuelle dans l’application.' })
  secret!: string;
  @ApiProperty({ description: 'URI otpauth://' }) uri!: string;
  @ApiProperty({ description: 'QR code (image PNG en data URL).' }) qrCode!: string;
}

export class MessageDto {
  @ApiProperty() message!: string;
}
