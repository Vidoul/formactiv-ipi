import type { ReactNode } from 'react';

interface CarteProps {
  titre?: ReactNode;
  /** Niveau de titre pour respecter la hiérarchie de la page (RGAA 9.1). */
  niveauTitre?: 2 | 3;
  legende?: ReactNode;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
  /** Identifiant du titre, pour étiqueter une région (aria-labelledby). */
  idTitre?: string;
}

export function Carte({
  titre,
  niveauTitre = 2,
  legende,
  actions,
  className,
  children,
  idTitre,
}: CarteProps) {
  const Titre = niveauTitre === 2 ? 'h2' : 'h3';
  return (
    <section
      className={['carte', className].filter(Boolean).join(' ')}
      aria-labelledby={titre && idTitre ? idTitre : undefined}
    >
      {(titre || actions) && (
        <div className="rangee" style={{ justifyContent: 'space-between' }}>
          {titre && (
            <Titre className="carte__titre" id={idTitre}>
              {titre}
            </Titre>
          )}
          {actions}
        </div>
      )}
      {legende && <p className="carte__legende">{legende}</p>}
      {children}
    </section>
  );
}
