import { SetMetadata } from '@nestjs/common';

export const CLE_PUBLIC = 'formactiv:public';

/**
 * Marque une route comme accessible sans authentification. Toute autre route exige un jeton
 * valide ET une déclaration explicite des rôles autorisés (refus par défaut, OWASP A01).
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(CLE_PUBLIC, true);
