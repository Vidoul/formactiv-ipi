import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Violation d'une règle de gestion (RG-xx) : renvoie par défaut un 409 avec un code stable
 * exploitable par le front (convention d'erreurs du chapitre 9).
 *
 * @example throw new RegleMetierException('INSCRIPTION_EXISTANTE', "L'apprenant est déjà inscrit (RG-INSC-01)");
 */
export class RegleMetierException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    statut: HttpStatus = HttpStatus.CONFLICT,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, statut);
  }
}
