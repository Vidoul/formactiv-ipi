import type { ReactNode } from 'react';
import type { VarianteBadge } from '../../utils/libelles';

/**
 * Pastille de statut. Le libellé texte est obligatoire : la couleur ne porte jamais seule
 * l'information (RGAA 3.1, engagement du chapitre 11).
 */
export function Badge({ variante, children }: { variante: VarianteBadge; children: ReactNode }) {
  return <span className={`badge badge--${variante}`}>{children}</span>;
}

/** Badge construit depuis une table de libellés (statuts d'inscription, de formation…). */
export function BadgeStatut<T extends string>({
  statut,
  libelles,
}: {
  statut: T;
  libelles: Record<T, { libelle: string; variante: VarianteBadge }>;
}) {
  const { libelle, variante } = libelles[statut];
  return <Badge variante={variante}>{libelle}</Badge>;
}
