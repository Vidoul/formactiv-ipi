import type { ButtonHTMLAttributes } from 'react';

export interface BoutonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primaire' | 'secondaire' | 'danger' | 'lien';
  petit?: boolean;
  bloc?: boolean;
  /** Affiche un état occupé : le bouton est désactivé et annoncé comme tel (aria-busy). */
  chargement?: boolean;
}

export function Bouton({
  variante = 'primaire',
  petit = false,
  bloc = false,
  chargement = false,
  className,
  disabled,
  type = 'button',
  children,
  ...reste
}: BoutonProps) {
  const classes = [
    'bouton',
    `bouton--${variante}`,
    petit && 'bouton--petit',
    bloc && 'bouton--bloc',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || chargement}
      aria-busy={chargement || undefined}
      {...reste}
    >
      {children}
    </button>
  );
}
