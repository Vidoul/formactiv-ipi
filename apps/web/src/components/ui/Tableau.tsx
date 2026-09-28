import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

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
 * horizontal sur petit écran sans perte d'information (RGAA 10.11). Lorsque le tableau déborde,
 * son conteneur devient une région focalisable, nommée par la légende, pour permettre le
 * défilement au clavier (RGAA 12.13, WCAG 2.1.1).
 */
export function Tableau<T>({
  legende,
  colonnes,
  lignes,
  cleLigne,
  vide = 'Aucune donnée à afficher.',
  legendeMasquee = false,
}: TableauProps<T>) {
  const idLegende = useId();
  const conteneur = useRef<HTMLDivElement>(null);
  const [defilant, setDefilant] = useState(false);

  useEffect(() => {
    const element = conteneur.current;
    if (!element) return;
    const mesurer = () => setDefilant(element.scrollWidth > element.clientWidth + 1);
    mesurer();
    if (typeof ResizeObserver === 'undefined') return;
    const observateur = new ResizeObserver(mesurer);
    observateur.observe(element);
    if (element.firstElementChild) observateur.observe(element.firstElementChild);
    return () => observateur.disconnect();
  }, [lignes, colonnes.length]);

  return (
    <div
      ref={conteneur}
      className="tableau-conteneur"
      role={defilant ? 'region' : undefined}
      aria-labelledby={defilant ? idLegende : undefined}
      // Région défilante nommée : focalisable pour défiler au clavier (axe « scrollable-region-
      // focusable »), motif que la règle jsx-a11y ne reconnaît pas lorsque le rôle est conditionnel.
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={defilant ? 0 : undefined}
    >
      <table className="tableau">
        <caption id={idLegende} className={legendeMasquee ? 'sr-only' : undefined}>
          {legende}
        </caption>
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
