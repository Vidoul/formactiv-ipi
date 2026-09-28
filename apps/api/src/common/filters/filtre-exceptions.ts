import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { contexteRequete } from '../context/contexte-requete';

/** Corps d'erreur normalisé renvoyé par toute l'API (chapitre 9 : code, message, détails). */
export interface CorpsErreur {
  statusCode: number;
  code: string;
  message: string;
  details?: unknown;
}

const CODES_PAR_STATUT: Record<number, string> = {
  400: 'REQUETE_INVALIDE',
  401: 'NON_AUTHENTIFIE',
  403: 'ACCES_REFUSE',
  404: 'RESSOURCE_INTROUVABLE',
  409: 'CONFLIT',
  413: 'CHARGE_TROP_VOLUMINEUSE',
  423: 'COMPTE_VERROUILLE',
  429: 'TROP_DE_REQUETES',
};

/**
 * Filtre global : transforme toute exception en réponse JSON normalisée.
 *
 * OWASP A05 : aucune fuite de détail technique (pile d'appel, requête SQL) vers le client ; les
 * erreurs 5xx sont journalisées côté serveur avec l'identifiant de requête pour le diagnostic.
 */
@Catch()
export class FiltreExceptions implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const reponse = http.getResponse<Response>();
    const requete = http.getRequest<Request>();
    const corps = normaliserException(exception);
    const idRequete = contexteRequete.courant()?.idRequete;

    if (corps.statusCode >= 500) {
      const pile = exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(`[${idRequete}] ${requete.method} ${requete.originalUrl} — ${pile}`);
    }

    reponse.status(corps.statusCode).json({
      ...corps,
      chemin: requete.originalUrl,
      horodatage: new Date().toISOString(),
      idRequete,
    });
  }
}

export function normaliserException(exception: unknown): CorpsErreur {
  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const reponse = exception.getResponse();
    if (typeof reponse === 'object' && reponse !== null) {
      const r = reponse as { code?: unknown; message?: unknown; details?: unknown };
      const message = Array.isArray(r.message) ? r.message.join(' ; ') : r.message;
      return {
        statusCode,
        code: typeof r.code === 'string' ? r.code : (CODES_PAR_STATUT[statusCode] ?? 'ERREUR'),
        message: typeof message === 'string' ? message : exception.message,
        ...(r.details !== undefined ? { details: r.details } : {}),
      };
    }
    return {
      statusCode,
      code: CODES_PAR_STATUT[statusCode] ?? 'ERREUR',
      message: String(reponse),
    };
  }

  // Erreurs du parseur de corps Express (http-errors) : JSON malformé, charge trop volumineuse.
  if (estErreurClientHttp(exception)) {
    const statusCode = exception.status;
    return {
      statusCode,
      code: CODES_PAR_STATUT[statusCode] ?? 'REQUETE_INVALIDE',
      message:
        exception.type === 'entity.too.large'
          ? 'Le corps de la requête dépasse la taille autorisée.'
          : exception.type === 'entity.parse.failed'
            ? 'Le corps de la requête n’est pas un JSON valide.'
            : 'Requête invalide.',
    };
  }

  if (exception instanceof Prisma.PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'CONFLIT_UNICITE',
          message: 'Une ressource identique existe déjà.',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'CONTRAINTE_REFERENCE',
          message: 'Opération impossible : la ressource est référencée par d’autres données.',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          code: 'RESSOURCE_INTROUVABLE',
          message: 'Ressource introuvable.',
        };
      // Conflit de sérialisation entre deux transactions concurrentes (ex. dernière place).
      case 'P2034':
        return {
          statusCode: HttpStatus.CONFLICT,
          code: 'CONFLIT_CONCURRENT',
          message: 'Une opération concurrente a modifié ces données : veuillez réessayer.',
        };
    }
  }

  if (
    exception instanceof Prisma.PrismaClientUnknownRequestError &&
    /check constraint/i.test(exception.message)
  ) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      code: 'CONTRAINTE_VIOLEE',
      message: 'Les données ne respectent pas une contrainte de gestion.',
    };
  }

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'ERREUR_INTERNE',
    message: 'Une erreur interne est survenue.',
  };
}

function estErreurClientHttp(e: unknown): e is { status: number; type?: string } {
  if (typeof e !== 'object' || e === null) return false;
  const { status, expose } = e as { status?: unknown; expose?: unknown };
  return typeof status === 'number' && status >= 400 && status < 500 && expose === true;
}
