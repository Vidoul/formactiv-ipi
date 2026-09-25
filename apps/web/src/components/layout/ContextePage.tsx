import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface ElementFilAriane {
  libelle: string;
  chemin?: string;
}

interface ValeurContextePage {
  filAriane: ElementFilAriane[];
  definirFilAriane: (f: ElementFilAriane[]) => void;
}

const ContextePage = createContext<ValeurContextePage | null>(null);

export function FournisseurPage({ children }: { children: ReactNode }) {
  const [filAriane, definirFilAriane] = useState<ElementFilAriane[]>([]);
  return (
    <ContextePage.Provider value={{ filAriane, definirFilAriane }}>
      {children}
    </ContextePage.Provider>
  );
}

export function useFilAriane(): ElementFilAriane[] {
  return useContext(ContextePage)?.filAriane ?? [];
}

/**
 * Déclare le titre de la page courante :
 * - titre de document unique et pertinent (RGAA 8.6) : « Planifier une session — FORMACTIV » ;
 * - dernier élément du fil d'Ariane (chapitre 11 : navigation constante).
 */
export function usePage(titre: string, parents: ElementFilAriane[] = []): void {
  const contexte = useContext(ContextePage);
  const definir = contexte?.definirFilAriane;
  const cleParents = JSON.stringify(parents);

  useEffect(() => {
    document.title = `${titre} — FORMACTIV`;
  }, [titre]);

  useEffect(() => {
    definir?.([...(JSON.parse(cleParents) as ElementFilAriane[]), { libelle: titre }]);
  }, [definir, titre, cleParents]);
}
