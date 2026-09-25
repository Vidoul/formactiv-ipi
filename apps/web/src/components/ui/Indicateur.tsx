import type { ReactNode } from 'react';

interface IndicateurProps {
  valeur: ReactNode;
  libelle: string;
  complement?: ReactNode;
  tonalite?: 'positive' | 'negative' | 'neutre';
}

/** Carte d'indicateur clé (KPI) des tableaux de bord (RG-DASH-01). */
export function Indicateur({ valeur, libelle, complement, tonalite = 'neutre' }: IndicateurProps) {
  return (
    <div className="carte">
      <p style={{ margin: 0 }}>
        <span className="indicateur__valeur">{valeur}</span>
        <span className="indicateur__libelle">{libelle}</span>
        {complement && (
          <span
            className={
              tonalite === 'neutre'
                ? 'indicateur__tendance'
                : `indicateur__tendance indicateur__tendance--${tonalite}`
            }
          >
            {complement}
          </span>
        )}
      </p>
    </div>
  );
}
