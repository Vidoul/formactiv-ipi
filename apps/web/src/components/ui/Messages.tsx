import type { ReactNode } from 'react';
import { ErreurApi } from '../../api/client';

type TypeAlerte = 'info' | 'succes' | 'alerte' | 'erreur';

/**
 * Message contextuel. Les erreurs sont annoncées immédiatement (role="alert"), les autres
 * messages poliment (role="status") — RGAA 7.5.
 */
export function Alerte({
  type = 'info',
  titre,
  children,
}: {
  type?: TypeAlerte;
  titre?: string;
  children: ReactNode;
}) {
  return (
    <div className={`alerte alerte--${type}`} role={type === 'erreur' ? 'alert' : 'status'}>
      {titre && <p style={{ fontWeight: 700, marginBottom: 'var(--espace-1)' }}>{titre}</p>}
      {children}
    </div>
  );
}

/** Message lisible d'une erreur d'API (ou message générique). */
export function messageErreur(erreur: unknown): string {
  return erreur instanceof ErreurApi
    ? erreur.message
    : 'Une erreur inattendue est survenue. Veuillez réessayer.';
}

/** Affiche le message d'une erreur d'API (ou un message générique). */
export function AlerteErreur({ erreur }: { erreur: unknown }) {
  return (
    <Alerte type="erreur">
      <p>{messageErreur(erreur)}</p>
    </Alerte>
  );
}

export function EtatVide({ titre, children }: { titre: string; children?: ReactNode }) {
  return (
    <div className="etat-vide">
      <p className="etat-vide__titre">{titre}</p>
      {children}
    </div>
  );
}

export function Chargement({ libelle = 'Chargement en cours…' }: { libelle?: string }) {
  return (
    <div className="chargement" role="status">
      <span className="chargement__roue" aria-hidden="true" />
      {libelle}
    </div>
  );
}
