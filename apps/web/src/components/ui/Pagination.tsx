import { Bouton } from './Bouton';

interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  surChangement: (page: number) => void;
  /** Nom des éléments paginés, pour un libellé explicite (« comptes », « entrées »). */
  elements?: string;
}

/** Pagination des listes (ch. 9 : pagination systématique ; ch. 8 : sobriété). */
export function Pagination({
  page,
  limit,
  total,
  surChangement,
  elements = 'éléments',
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (total <= limit) {
    return (
      <p className="pagination">
        {total} {elements}
      </p>
    );
  }
  return (
    <nav className="pagination" aria-label={`Pagination des ${elements}`}>
      <span>
        {total} {elements} — page {page} sur {pages}
      </span>
      <span className="rangee">
        <Bouton
          variante="secondaire"
          petit
          disabled={page <= 1}
          onClick={() => surChangement(page - 1)}
        >
          Page précédente
        </Bouton>
        <Bouton
          variante="secondaire"
          petit
          disabled={page >= pages}
          onClick={() => surChangement(page + 1)}
        >
          Page suivante
        </Bouton>
      </span>
    </nav>
  );
}
