import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StatutCompte } from '@prisma/client';
import type { Request } from 'express';
import { JetonsService } from '../../modules/auth/jetons.service';
import { PrismaService } from '../../prisma/prisma.service';
import { contexteRequete } from '../context/contexte-requete';
import { CLE_PUBLIC } from '../decorators/public.decorator';

/**
 * Garde globale d'authentification (chapitre 10) : toute route exige un access token JWT valide,
 * sauf déclaration explicite @Public().
 */
@Injectable()
export class AuthentificationGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jetons: JetonsService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(contexte: ExecutionContext): Promise<boolean> {
    const publique = this.reflector.getAllAndOverride<boolean>(CLE_PUBLIC, [
      contexte.getHandler(),
      contexte.getClass(),
    ]);
    if (publique) return true;

    const requete = contexte.switchToHttp().getRequest<Request>();
    const [schema, jeton] = (requete.headers.authorization ?? '').split(' ');
    if (schema !== 'Bearer' || !jeton) {
      throw new UnauthorizedException({
        code: 'NON_AUTHENTIFIE',
        message: 'Authentification requise.',
      });
    }

    const charge = await this.jetons.verifierAcces(jeton);
    const compte = await this.prisma.utilisateur.findUnique({
      where: { id: charge.sub },
      select: {
        id: true,
        statutCompte: true,
        mfaActive: true,
        entrepriseId: true,
        role: { select: { code: true } },
      },
    });
    // Compte supprimé, désactivé, anonymisé ou rôle modifié depuis l'émission du jeton :
    // la session est invalidée immédiatement.
    if (
      !compte ||
      compte.statutCompte === StatutCompte.DESACTIVE ||
      compte.statutCompte === StatutCompte.ANONYMISE ||
      compte.role.code !== charge.role
    ) {
      throw new UnauthorizedException({ code: 'SESSION_INVALIDE', message: 'Session invalide.' });
    }

    requete.utilisateur = {
      id: compte.id,
      role: compte.role.code,
      entrepriseId: compte.entrepriseId,
      mfaActive: compte.mfaActive,
    };
    contexteRequete.definirUtilisateur(compte.id, compte.role.code);
    return true;
  }
}
