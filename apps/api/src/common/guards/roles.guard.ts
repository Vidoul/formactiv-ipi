import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { CodeRole } from '@prisma/client';
import type { Request } from 'express';
import { ActionJournal } from '../../modules/journal/actions-journal';
import { JournalService } from '../../modules/journal/journal.service';
import { CLE_PUBLIC } from '../decorators/public.decorator';
import { CLE_ROLES } from '../decorators/roles.decorator';

/**
 * Garde RBAC (REQ-SEC-003) : applique la colonne « rôle » de la matrice du chapitre 5.
 * Refus par défaut : une route sans déclaration de rôles est inaccessible. Chaque refus est
 * journalisé (UC-08 E1 : « refus (RBAC) + journalisation »).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly journal: JournalService,
  ) {}

  async canActivate(contexte: ExecutionContext): Promise<boolean> {
    const cibles = [contexte.getHandler(), contexte.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(CLE_PUBLIC, cibles)) return true;

    const requete = contexte.switchToHttp().getRequest<Request>();
    const roles = this.reflector.getAllAndOverride<CodeRole[] | undefined>(CLE_ROLES, cibles);
    if (!roles) {
      this.logger.error(
        `Route sans déclaration de rôles refusée : ${requete.method} ${requete.path}`,
      );
    }
    if (roles && requete.utilisateur && roles.includes(requete.utilisateur.role)) return true;

    await this.journal.enregistrerSansBloquer({
      action: ActionJournal.ACCES_REFUSE,
      typeObjet: 'route',
      details: `${requete.method} ${requete.originalUrl.split('?')[0]}`,
    });
    throw new ForbiddenException({
      code: 'ACCES_REFUSE',
      message: "Vous n'avez pas les droits nécessaires pour cette action.",
    });
  }
}
