import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import type { UtilisateurAuthentifie } from '../auth/utilisateur-authentifie';

/** Injecte l'utilisateur authentifié dans un paramètre de contrôleur. */
export const UtilisateurConnecte = createParamDecorator(
  (_donnees: unknown, contexte: ExecutionContext): UtilisateurAuthentifie => {
    const requete = contexte.switchToHttp().getRequest<Request>();
    if (!requete.utilisateur) throw new UnauthorizedException();
    return requete.utilisateur;
  },
);
