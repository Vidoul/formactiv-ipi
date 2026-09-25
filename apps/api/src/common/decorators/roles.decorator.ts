import { SetMetadata } from '@nestjs/common';
import { CodeRole } from '@prisma/client';

export const CLE_ROLES = 'formactiv:roles';
export const CLE_SANS_MFA = 'formactiv:sans-mfa';

/**
 * Rôles autorisés sur une route (matrice RBAC du chapitre 5). Une route authentifiée sans cette
 * déclaration est refusée (refus par défaut, OWASP A01). Les portées fines — « ses sessions »,
 * « son entreprise », « soi-même » — sont appliquées ensuite par les services.
 */
export const Roles = (...roles: CodeRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(CLE_ROLES, roles);

/** Route accessible à tout utilisateur authentifié, quel que soit son rôle. */
export const Authentifie = (): MethodDecorator & ClassDecorator =>
  SetMetadata(CLE_ROLES, Object.values(CodeRole));

/**
 * Route accessible même si la double authentification obligatoire n'est pas encore configurée
 * (RG-AUTH-03) : profil, configuration MFA, déconnexion.
 */
export const AutoriseSansMfa = (): MethodDecorator & ClassDecorator =>
  SetMetadata(CLE_SANS_MFA, true);
