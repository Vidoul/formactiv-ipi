import { useId } from 'react';

export interface PointGraphique {
  libelle: string;
  valeur: number;
  /** Libellé long pour l'alternative textuelle (ex. « Lundi » pour « Lu »). */
  libelleLong?: string;
}

interface GraphiqueBarresProps {
  titre: string;
  donnees: PointGraphique[];
  /** Nom de la série, repris dans la légende et l'alternative (ex. « Connexions réussies »). */
  serie: string;
  unite?: string;
  couleur?: 'bleu' | 'vert';
}

const HAUTEUR = 150;
const LARGEUR_BARRE = 34;
const PAS = 64;

/**
 * Histogramme léger en SVG (aucune bibliothèque : sobriété, ch. 8).
 *
 * Accessibilité (RGAA 1.3, engagement ch. 11 « alternatives textuelles aux graphiques ») : le
 * dessin est masqué aux technologies d'assistance et remplacé par un tableau de valeurs
 * équivalent, lu par les lecteurs d'écran.
 */
export function GraphiqueBarres({
  titre,
  donnees,
  serie,
  unite = '',
  couleur = 'bleu',
}: GraphiqueBarresProps) {
  const idTitre = useId();
  const maximum = Math.max(1, ...donnees.map((d) => d.valeur));
  const largeur = Math.max(PAS * donnees.length, PAS);
  const remplissage =
    couleur === 'vert' ? 'var(--couleur-graphique-vert)' : 'var(--couleur-graphique-bleu)';

  return (
    <figure style={{ margin: 0 }} aria-labelledby={idTitre}>
      <figcaption id={idTitre} className="sr-only">
        {titre}
      </figcaption>
      <svg
        className="graphique-barres"
        viewBox={`0 0 ${largeur} ${HAUTEUR + 40}`}
        aria-hidden="true"
        focusable="false"
        preserveAspectRatio="xMidYMid meet"
      >
        <line
          x1={0}
          x2={largeur}
          y1={HAUTEUR + 16}
          y2={HAUTEUR + 16}
          stroke="var(--couleur-bordure)"
        />
        {donnees.map((d, i) => {
          const h = Math.round((d.valeur / maximum) * (HAUTEUR - 10));
          const x = i * PAS + (PAS - LARGEUR_BARRE) / 2;
          const y = HAUTEUR + 16 - h;
          return (
            <g key={d.libelle}>
              <rect x={x} y={y} width={LARGEUR_BARRE} height={h} rx={3} fill={remplissage} />
              <text
                className="graphique-barres__valeur"
                x={x + LARGEUR_BARRE / 2}
                y={y - 4}
                textAnchor="middle"
              >
                {d.valeur}
              </text>
              <text x={x + LARGEUR_BARRE / 2} y={HAUTEUR + 32} textAnchor="middle">
                {d.libelle}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="legende" aria-hidden="true">
        <span
          className={`legende__pastille${couleur === 'vert' ? ' legende__pastille--vert' : ''}`}
        />
        {serie}
      </p>
      <table className="sr-only">
        <caption>
          {titre} — {serie}
        </caption>
        <thead>
          <tr>
            <th scope="col">Période</th>
            <th scope="col">{serie}</th>
          </tr>
        </thead>
        <tbody>
          {donnees.map((d) => (
            <tr key={d.libelle}>
              <th scope="row">{d.libelleLong ?? d.libelle}</th>
              <td>
                {d.valeur}
                {unite}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
