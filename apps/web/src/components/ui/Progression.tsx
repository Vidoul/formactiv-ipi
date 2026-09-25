interface ProgressionProps {
  libelle: string;
  /** Pourcentage de 0 à 100. */
  pourcentage: number;
  /** Texte affiché à droite (par défaut « NN % »), ex. « Terminée — certificat obtenu ». */
  texteValeur?: string;
  couleur?: 'bleu' | 'vert';
}

/**
 * Barre de progression horizontale (taux par formation, progression d'un apprenant).
 * L'information est portée par le texte « libellé + valeur » ; la barre est décorative.
 */
export function Progression({
  libelle,
  pourcentage,
  texteValeur,
  couleur = 'bleu',
}: ProgressionProps) {
  const borne = Math.min(100, Math.max(0, Math.round(pourcentage)));
  return (
    <div className="progression">
      <p className="progression__entete" style={{ margin: 0 }}>
        <span>{libelle}</span>
        <span className="progression__valeur">{texteValeur ?? `${borne} %`}</span>
      </p>
      <div className="progression__piste" aria-hidden="true">
        <div
          className={`progression__barre${couleur === 'vert' ? ' progression__barre--vert' : ''}`}
          style={{ width: `${borne}%` }}
        />
      </div>
    </div>
  );
}
