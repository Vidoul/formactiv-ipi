import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';

/** Champs qui ne doivent JAMAIS quitter l'API, quelle que soit la réponse (REQ-SEC-001). */
export const CHAMPS_SENSIBLES = new Set([
  'motDePasseHash',
  'mfaSecretChiffre',
  'mfaDernierPas',
  'empreinte',
  'tentativesEchouees',
]);

/**
 * Filet de sécurité (défense en profondeur, OWASP A01/A02) : même si un service renvoyait par
 * erreur une entité brute, les champs sensibles sont retirés avant sérialisation. Les services
 * restent tenus de ne sélectionner que les colonnes nécessaires (minimisation).
 */
@Injectable()
export class DonneesSensiblesInterceptor implements NestInterceptor {
  intercept(_contexte: ExecutionContext, suivant: CallHandler): Observable<unknown> {
    return suivant.handle().pipe(map((donnees: unknown) => retirerChampsSensibles(donnees)));
  }
}

export function retirerChampsSensibles<T>(valeur: T): T {
  if (Array.isArray(valeur)) {
    return valeur.map((v: unknown) => retirerChampsSensibles(v)) as T;
  }
  if (estObjetSimple(valeur)) {
    const copie: Record<string, unknown> = {};
    for (const [cle, v] of Object.entries(valeur)) {
      if (!CHAMPS_SENSIBLES.has(cle)) copie[cle] = retirerChampsSensibles(v);
    }
    return copie as T;
  }
  return valeur;
}

function estObjetSimple(valeur: unknown): valeur is Record<string, unknown> {
  if (valeur === null || typeof valeur !== 'object') return false;
  const prototype = Object.getPrototypeOf(valeur) as unknown;
  return prototype === Object.prototype || prototype === null;
}
