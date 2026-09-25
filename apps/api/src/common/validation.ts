import { BadRequestException, ValidationError, ValidationPipe } from '@nestjs/common';

export interface ErreurChamp {
  champ: string;
  messages: string[];
}

/** Aplati les erreurs class-validator (y compris imbriquées) en liste champ → messages. */
export function aplatirErreurs(erreurs: ValidationError[], parent = ''): ErreurChamp[] {
  return erreurs.flatMap((e) => {
    const champ = parent ? `${parent}.${e.property}` : e.property;
    const propres = e.constraints
      ? [{ champ, messages: Object.values(e.constraints) }]
      : ([] as ErreurChamp[]);
    return [...propres, ...aplatirErreurs(e.children ?? [], champ)];
  });
}

/**
 * Validation stricte de toutes les entrées (OWASP A03 / A04) :
 * - `whitelist` + `forbidNonWhitelisted` : tout champ non déclaré dans le DTO est rejeté
 *   (protection contre l'affectation de masse, ex. un apprenant qui tenterait d'envoyer `role`) ;
 * - erreurs renvoyées par champ (400) pour l'affichage en ligne côté front (chapitre 11).
 */
export function creerValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: false,
    exceptionFactory: (erreurs) =>
      new BadRequestException({
        code: 'VALIDATION',
        message: 'Certaines données sont invalides.',
        details: aplatirErreurs(erreurs),
      }),
  });
}
