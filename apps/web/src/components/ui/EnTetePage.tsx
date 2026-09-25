import type { ReactNode } from 'react';

/** Titre de page (h1 unique, RGAA 9.1) avec sous-titre et actions principales. */
export function EnTetePage({
  titre,
  sousTitre,
  actions,
}: {
  titre: ReactNode;
  sousTitre?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="en-tete-page">
      <div>
        <h1>{titre}</h1>
        {sousTitre && <p className="en-tete-page__sous-titre">{sousTitre}</p>}
      </div>
      {actions && <div className="rangee">{actions}</div>}
    </div>
  );
}
