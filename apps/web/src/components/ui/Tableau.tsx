import type { ReactNode } from 'react';

export interface Colonne<T> {
  cle: string;
  entete: ReactNode;
  rendu: (ligne: T) => ReactNode;
  /** Colonne numérique : alignée à droite. */
  nombre?: boolean;
  /** Cellule d'en-tête de ligne (RGAA 5.7) — généralement la première colonne. */
  enteteLigne?: boolean;
}

interface TableauProps<T> {
  /** Titre du tableau (RGAA 5.4), affiché en légende `<caption>`. */
  legende: string;
  colonnes: Colonne<T>[];
  lignes: T[];
  cleLigne: (ligne: T) => string;
  /** Message affiché lorsqu'il n'y a aucune donnée. */
  vide?: ReactNode;
  legendeMasquee?: boolean;
}

/**
 * Tableau de données accessible (RGAA 5) : `<caption>`, en-têtes `<th scope>`, défilement
 * horizontal sur petit écran sans perte d'information (RGAA 10.11).
 */
export function Tableau<T>({
  legende,
  colonnes,
  lignes,
  cleLigne,
  vide = 'Aucune donnée à afficher.',
  legendeMasquee = false,
}: TableauProps<T>) {
  return (
    <div className="tableau-conteneur">
      <table className="tableau">
        <caption className={legendeMasquee ? 'sr-only' : undefined}>{legende}</caption>
        <thead>
          <tr>
            {colonnes.map((c) => (
              <th key={c.cle} scope="col" className={c.nombre ? 'tableau__nombre' : undefined}>
                {c.entete}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.length === 0 ? (
            <tr>
              <td colSpan={colonnes.length}>{vide}</td>
            </tr>
          ) : (
            lignes.map((ligne) => (
              <tr key={cleLigne(ligne)}>
                {colonnes.map((c) => {
                  const classe = c.nombre ? 'tableau__nombre' : undefined;
                  return c.enteteLigne ? (
                    <th key={c.cle} scope="row" className={classe} style={{ fontWeight: 500 }}>
                      {c.rendu(ligne)}
                    </th>
                  ) : (
                    <td key={c.cle} className={classe}>
                      {c.rendu(ligne)}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
