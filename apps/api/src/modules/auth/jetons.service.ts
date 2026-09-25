import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CodeRole, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { empreinte, genererJeton } from '../../common/securite/jetons';
import type { Environnement } from '../../config/environnement';
import { PrismaService } from '../../prisma/prisma.service';
import { ActionJournal } from '../journal/actions-journal';
import { JournalService } from '../journal/journal.service';

const EMETTEUR = 'formactiv-api';
const AUDIENCE = 'formactiv-web';
const DUREE_JETON_MFA_SECONDES = 300;
/**
 * Fenêtre de tolérance pour deux rafraîchissements quasi simultanés (plusieurs onglets) : un jeton
 * révoqué depuis moins de 15 s n'est pas traité comme un vol.
 */
const TOLERANCE_CONCURRENCE_MS = 15_000;

interface ChargeAcces {
  sub: string;
  role: CodeRole;
  typ: 'acces';
}

interface ChargeMfa {
  sub: string;
  typ: 'mfa';
}

export interface RefreshEmis {
  jeton: string;
  expiration: Date;
}

/**
 * Émission et vérification des jetons (ADR-04, chapitre 10) :
 * - access token JWT HS256 de 15 min (émetteur, audience et type contrôlés) ;
 * - jeton MFA intermédiaire de 5 min, signé avec un secret distinct ;
 * - refresh token opaque, stocké haché, à rotation systématique ; la réutilisation d'un jeton
 *   déjà renouvelé révoque toute la famille de jetons (détection de vol).
 */
@Injectable()
export class JetonsService {
  private readonly logger = new Logger(JetonsService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Environnement, true>,
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  get dureeAccesSecondes(): number {
    return this.config.get('JWT_ACCESS_TTL_SECONDES', { infer: true });
  }

  emettreAcces(utilisateur: { id: string; role: CodeRole }): string {
    const charge: ChargeAcces = { sub: utilisateur.id, role: utilisateur.role, typ: 'acces' };
    return this.jwt.sign(charge, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.dureeAccesSecondes,
      issuer: EMETTEUR,
      audience: AUDIENCE,
      algorithm: 'HS256',
    });
  }

  async verifierAcces(jeton: string): Promise<ChargeAcces> {
    try {
      const charge = await this.jwt.verifyAsync<ChargeAcces>(jeton, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        issuer: EMETTEUR,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      if (charge.typ !== 'acces') throw new Error('type de jeton inattendu');
      return charge;
    } catch {
      throw new UnauthorizedException({
        code: 'JETON_INVALIDE',
        message: 'Session expirée ou invalide.',
      });
    }
  }

  emettreJetonMfa(utilisateurId: string): string {
    const charge: ChargeMfa = { sub: utilisateurId, typ: 'mfa' };
    return this.jwt.sign(charge, {
      secret: this.config.get('JWT_MFA_SECRET', { infer: true }),
      expiresIn: DUREE_JETON_MFA_SECONDES,
      issuer: EMETTEUR,
      audience: `${AUDIENCE}:mfa`,
      algorithm: 'HS256',
    });
  }

  async verifierJetonMfa(jeton: string): Promise<string> {
    try {
      const charge = await this.jwt.verifyAsync<ChargeMfa>(jeton, {
        secret: this.config.get('JWT_MFA_SECRET', { infer: true }),
        issuer: EMETTEUR,
        audience: `${AUDIENCE}:mfa`,
        algorithms: ['HS256'],
      });
      if (charge.typ !== 'mfa') throw new Error('type de jeton inattendu');
      return charge.sub;
    } catch {
      throw new UnauthorizedException({
        code: 'JETON_MFA_INVALIDE',
        message: 'La vérification a expiré. Veuillez vous reconnecter.',
      });
    }
  }

  private expirationRefresh(): Date {
    const jours = this.config.get('REFRESH_TOKEN_TTL_JOURS', { infer: true });
    return new Date(Date.now() + jours * 86_400_000);
  }

  async creerRefresh(
    utilisateurId: string,
    famille: string = randomUUID(),
    tx?: Prisma.TransactionClient,
  ): Promise<RefreshEmis> {
    const jeton = genererJeton();
    const expiration = this.expirationRefresh();
    await (tx ?? this.prisma).jetonRefresh.create({
      data: { utilisateurId, famille, empreinte: empreinte(jeton), dateExpiration: expiration },
    });
    return { jeton, expiration };
  }

  /** Rotation : le jeton présenté est révoqué et remplacé par un nouveau de la même famille. */
  async tournerRefresh(jetonPresente: string): Promise<RefreshEmis & { utilisateurId: string }> {
    const refus = (code = 'REFRESH_INVALIDE') =>
      new UnauthorizedException({ code, message: 'Session expirée, veuillez vous reconnecter.' });

    const existant = await this.prisma.jetonRefresh.findUnique({
      where: { empreinte: empreinte(jetonPresente) },
    });
    if (!existant) throw refus();

    const maintenant = new Date();
    if (existant.dateRevocation) {
      if (maintenant.getTime() - existant.dateRevocation.getTime() < TOLERANCE_CONCURRENCE_MS) {
        throw refus('REFRESH_CONCURRENT');
      }
      // Réutilisation d'un jeton déjà renouvelé : vol probable → révocation de toute la famille.
      await this.prisma.jetonRefresh.updateMany({
        where: { famille: existant.famille, dateRevocation: null },
        data: { dateRevocation: maintenant },
      });
      this.logger.warn(`Réutilisation d'un refresh token révoqué (famille ${existant.famille})`);
      await this.journal.enregistrerSansBloquer({
        action: ActionJournal.REUTILISATION_JETON,
        utilisateurId: existant.utilisateurId,
        typeObjet: 'utilisateur',
        idObjet: existant.utilisateurId,
        details:
          'Réutilisation d’un refresh token révoqué : toutes les sessions liées sont fermées',
      });
      throw refus();
    }
    if (existant.dateExpiration <= maintenant) throw refus();

    return this.prisma.$transaction(async (tx) => {
      // Mise à jour conditionnelle : empêche deux rotations concurrentes du même jeton.
      const revoque = await tx.jetonRefresh.updateMany({
        where: { id: existant.id, dateRevocation: null },
        data: { dateRevocation: maintenant },
      });
      if (revoque.count === 0) throw refus('REFRESH_CONCURRENT');
      const nouveau = await this.creerRefresh(existant.utilisateurId, existant.famille, tx);
      return { ...nouveau, utilisateurId: existant.utilisateurId };
    });
  }

  async revoquerRefresh(jeton: string): Promise<string | null> {
    const existant = await this.prisma.jetonRefresh.findUnique({
      where: { empreinte: empreinte(jeton) },
    });
    if (!existant) return null;
    await this.prisma.jetonRefresh.updateMany({
      where: { famille: existant.famille, dateRevocation: null },
      data: { dateRevocation: new Date() },
    });
    return existant.utilisateurId;
  }

  /** Ferme toutes les sessions d'un utilisateur (changement de mot de passe, désactivation…). */
  async revoquerToutesLesSessions(
    utilisateurId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    await (tx ?? this.prisma).jetonRefresh.updateMany({
      where: { utilisateurId, dateRevocation: null },
      data: { dateRevocation: new Date() },
    });
  }
}
