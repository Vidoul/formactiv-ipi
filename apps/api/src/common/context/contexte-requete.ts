import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { CodeRole } from '@prisma/client';

/**
 * Contexte de la requête HTTP en cours (adresse IP, identifiant de requête, utilisateur
 * authentifié). Propagé par AsyncLocalStorage pour que les services — en particulier la
 * journalisation RG-LOG-01 — y accèdent sans le recevoir en paramètre.
 */
export interface ContexteRequete {
  idRequete: string;
  ip?: string;
  utilisateurId?: string;
  role?: CodeRole;
}

const stockage = new AsyncLocalStorage<ContexteRequete>();

export const contexteRequete = {
  courant(): ContexteRequete | undefined {
    return stockage.getStore();
  },

  /** Renseigné par la garde d'authentification une fois le jeton vérifié. */
  definirUtilisateur(utilisateurId: string, role: CodeRole): void {
    const ctx = stockage.getStore();
    if (ctx) {
      ctx.utilisateurId = utilisateurId;
      ctx.role = role;
    }
  },

  /** Exécute une fonction dans un contexte donné (tâches planifiées, tests). */
  executer<T>(ctx: ContexteRequete, fn: () => T): T {
    return stockage.run(ctx, fn);
  },
};

/** Middleware Express : ouvre un contexte par requête et expose l'identifiant de corrélation. */
export function middlewareContexteRequete(req: Request, res: Response, next: NextFunction): void {
  const idRequete = randomUUID();
  res.setHeader('X-Request-Id', idRequete);
  stockage.run({ idRequete, ip: req.ip }, () => next());
}
