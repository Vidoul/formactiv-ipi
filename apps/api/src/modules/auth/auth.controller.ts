import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import type { UtilisateurAuthentifie } from '../../common/auth/utilisateur-authentifie';
import { Public } from '../../common/decorators/public.decorator';
import { Authentifie, AutoriseSansMfa } from '../../common/decorators/roles.decorator';
import { UtilisateurConnecte } from '../../common/decorators/utilisateur-connecte.decorator';
import type { Environnement } from '../../config/environnement';
import { AuthService, type SessionOuverte } from './auth.service';
import {
  ActivationDto,
  ChangementMotDePasseDto,
  CodeMfaDto,
  ConnexionDto,
  DesactivationMfaDto,
  EnrolementMfaDto,
  MessageDto,
  MotDePasseOublieDto,
  ProfilDto,
  ReinitialisationDto,
  ReponseConnexionDto,
  SessionDto,
  VerificationMfaDto,
} from './dto/auth.dto';

export const COOKIE_REFRESH = 'formactiv_refresh';
/** Le cookie n'est envoyé qu'aux routes d'authentification (réduction de l'exposition). */
const CHEMIN_COOKIE = '/api/v1/auth';

/** Limite stricte sur les routes sensibles au bourrage d'identifiants (OWASP A07). */
const limiteAuth = () => Number(process.env.THROTTLE_LIMITE_AUTH ?? 10);
const LIMITE_AUTH = { global: { limit: limiteAuth, ttl: 60_000 } };

@ApiTags('Authentification')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Environnement, true>,
  ) {}

  private optionsCookie(expiration?: Date): CookieOptions {
    return {
      httpOnly: true, // inaccessible au JavaScript (vol par XSS)
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      sameSite: 'strict', // non envoyé par des sites tiers (CSRF)
      path: CHEMIN_COOKIE,
      expires: expiration,
    };
  }

  private repondreSession(res: Response, session: SessionOuverte): SessionDto {
    res.cookie(
      COOKIE_REFRESH,
      session.refresh.jeton,
      this.optionsCookie(session.refresh.expiration),
    );
    return {
      accessToken: session.accessToken,
      expireDans: session.expireDans,
      utilisateur: session.utilisateur,
    };
  }

  private lireCookie(req: Request): string | undefined {
    const valeur = (req.cookies as Record<string, unknown> | undefined)?.[COOKIE_REFRESH];
    return typeof valeur === 'string' && valeur.length > 0 ? valeur : undefined;
  }

  @Post('login')
  @Public()
  @Throttle(LIMITE_AUTH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Connexion email + mot de passe (UC-01)',
    description:
      'Si la MFA est active, renvoie `mfaRequis: true` et un jeton intermédiaire à présenter sur POST /auth/mfa. ' +
      'Sinon, renvoie l’access token et pose le refresh token en cookie httpOnly.',
  })
  @ApiOkResponse({ type: ReponseConnexionDto })
  @ApiResponse({ status: 401, description: 'Identifiants invalides (message générique).' })
  @ApiResponse({ status: 423, description: 'Compte temporairement verrouillé (RG-AUTH-02).' })
  async connecter(
    @Body() dto: ConnexionDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ReponseConnexionDto> {
    const resultat = await this.auth.connecter(dto.email, dto.motDePasse);
    if (resultat.type === 'MFA_REQUIS') return { mfaRequis: true, jetonMfa: resultat.jetonMfa };
    return { mfaRequis: false, ...this.repondreSession(res, resultat) };
  }

  @Post('mfa')
  @Public()
  @Throttle(LIMITE_AUTH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vérification du code TOTP (UC-01, étape 3)' })
  @ApiOkResponse({ type: SessionDto })
  async verifierMfa(
    @Body() dto: VerificationMfaDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionDto> {
    return this.repondreSession(res, await this.auth.verifierMfa(dto.jetonMfa, dto.code));
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth('refresh')
  @ApiOperation({ summary: "Renouvellement de l'access token (rotation du refresh token)" })
  @ApiOkResponse({ type: SessionDto })
  async rafraichir(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionDto> {
    const jeton = this.lireCookie(req);
    if (!jeton) {
      throw new UnauthorizedException({
        code: 'REFRESH_ABSENT',
        message: 'Aucune session active.',
      });
    }
    try {
      return this.repondreSession(res, await this.auth.rafraichir(jeton));
    } catch (erreur) {
      // Rafraîchissement concurrent (autre onglet) : le navigateur détient déjà le nouveau cookie,
      // il ne faut pas l'effacer. Dans tous les autres cas, le cookie invalide est supprimé.
      const code =
        erreur instanceof UnauthorizedException
          ? (erreur.getResponse() as { code?: string }).code
          : undefined;
      if (code !== 'REFRESH_CONCURRENT') res.clearCookie(COOKIE_REFRESH, this.optionsCookie());
      throw erreur;
    }
  }

  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Déconnexion : révocation du refresh token' })
  async deconnecter(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.deconnecter(this.lireCookie(req));
    res.clearCookie(COOKIE_REFRESH, this.optionsCookie());
  }

  @Post('mot-de-passe-oublie')
  @Public()
  @Throttle(LIMITE_AUTH)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Demande de lien de réinitialisation (UC-02, RG-AUTH-04)',
    description: 'Réponse identique que le compte existe ou non.',
  })
  @ApiResponse({ status: 202, type: MessageDto })
  async motDePasseOublie(@Body() dto: MotDePasseOublieDto): Promise<MessageDto> {
    await this.auth.demanderReinitialisation(dto.email);
    return {
      message:
        'Si un compte existe pour cette adresse, un email a été envoyé. Le lien est valable 30 minutes et ne peut être utilisé qu’une fois.',
    };
  }

  @Post('reinitialisation')
  @Public()
  @Throttle(LIMITE_AUTH)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Nouveau mot de passe via lien à usage unique (UC-02)' })
  async reinitialiser(@Body() dto: ReinitialisationDto): Promise<void> {
    await this.auth.reinitialiser(dto.jeton, dto.motDePasse);
  }

  @Post('activation')
  @Public()
  @Throttle(LIMITE_AUTH)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Activation du compte : mot de passe et consentement explicite (RG-RGPD-01)',
  })
  async activer(@Body() dto: ActivationDto): Promise<void> {
    await this.auth.activer(dto.jeton, dto.motDePasse, dto.consentementSatisfaction);
  }

  @Get('moi')
  @Authentifie()
  @AutoriseSansMfa()
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: "Profil de l'utilisateur connecté" })
  @ApiOkResponse({ type: ProfilDto })
  moi(@UtilisateurConnecte() utilisateur: UtilisateurAuthentifie): Promise<ProfilDto> {
    return this.auth.profil(utilisateur.id);
  }

  @Patch('mot-de-passe')
  @Authentifie()
  @AutoriseSansMfa()
  @Throttle(LIMITE_AUTH)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Changement de mot de passe (toutes les sessions sont ensuite fermées)',
  })
  async changerMotDePasse(
    @UtilisateurConnecte() utilisateur: UtilisateurAuthentifie,
    @Body() dto: ChangementMotDePasseDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.changerMotDePasse(utilisateur.id, dto.motDePasseActuel, dto.nouveauMotDePasse);
    res.clearCookie(COOKIE_REFRESH, this.optionsCookie());
  }

  @Post('mfa/enrolement')
  @Authentifie()
  @AutoriseSansMfa()
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Démarre la configuration de la double authentification (US-04)' })
  @ApiOkResponse({ type: EnrolementMfaDto })
  @HttpCode(HttpStatus.OK)
  demarrerEnrolement(
    @UtilisateurConnecte() utilisateur: UtilisateurAuthentifie,
  ): Promise<EnrolementMfaDto> {
    return this.auth.demarrerEnrolementMfa(utilisateur.id);
  }

  @Post('mfa/enrolement/confirmation')
  @Authentifie()
  @AutoriseSansMfa()
  @Throttle(LIMITE_AUTH)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @ApiOperation({
    summary: 'Active la double authentification après vérification d’un premier code',
  })
  @ApiOkResponse({ type: ProfilDto })
  confirmerEnrolement(
    @UtilisateurConnecte() utilisateur: UtilisateurAuthentifie,
    @Body() dto: CodeMfaDto,
  ): Promise<ProfilDto> {
    return this.auth.confirmerEnrolementMfa(utilisateur.id, dto.code);
  }

  @Post('mfa/desactivation')
  @Authentifie()
  @Throttle(LIMITE_AUTH)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('jwt')
  @ApiOperation({ summary: 'Désactive la MFA (interdit pour les rôles où elle est obligatoire)' })
  @ApiOkResponse({ type: ProfilDto })
  desactiverMfa(
    @UtilisateurConnecte() utilisateur: UtilisateurAuthentifie,
    @Body() dto: DesactivationMfaDto,
  ): Promise<ProfilDto> {
    return this.auth.desactiverMfa(utilisateur.id, dto.motDePasse, dto.code);
  }
}
