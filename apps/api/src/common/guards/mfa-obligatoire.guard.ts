import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ParametresService } from '../../modules/parametres/parametres.service';
import { CLE_PUBLIC } from '../decorators/public.decorator';
import { CLE_SANS_MFA } from '../decorators/roles.decorator';

/**
 * RG-AUTH-03 : la MFA est obligatoire pour les rôles paramétrés (Administrateur et Responsable
 * formation par défaut). Tant qu'elle n'est pas configurée, seules les routes nécessaires à son
 * activation restent accessibles.
 */
@Injectable()
export class MfaObligatoireGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly parametres: ParametresService,
  ) {}

  async canActivate(contexte: ExecutionContext): Promise<boolean> {
    const cibles = [contexte.getHandler(), contexte.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLE_PUBLIC, cibles)) return true;
    if (this.reflector.getAllAndOverride<boolean>(CLE_SANS_MFA, cibles)) return true;

    const utilisateur = contexte.switchToHttp().getRequest<Request>().utilisateur;
    if (!utilisateur || utilisateur.mfaActive) return true;

    const rolesConcernes = await this.parametres.rolesMfaObligatoire();
    if (!rolesConcernes.includes(utilisateur.role)) return true;

    throw new ForbiddenException({
      code: 'MFA_ENROLEMENT_REQUIS',
      message: 'La double authentification doit être activée pour accéder à cette fonctionnalité.',
    });
  }
}
