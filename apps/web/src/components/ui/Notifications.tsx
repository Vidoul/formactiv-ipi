import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface Notification {
  id: number;
  type: 'succes' | 'erreur';
  message: string;
}

interface Notifier {
  succes: (message: string) => void;
  erreur: (message: string) => void;
}

const ContexteNotifications = createContext<Notifier | null>(null);

const DUREE_AFFICHAGE_MS = 6000;

/**
 * Notifications de confirmation d'action. Les messages sont restitués par une zone ARIA live
 * (RGAA 7.5) et restent affichés suffisamment longtemps ; chacun peut être fermé au clavier.
 */
export function FournisseurNotifications({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<Notification[]>([]);

  const retirer = useCallback((id: number) => {
    setListe((l) => l.filter((n) => n.id !== id));
  }, []);

  const ajouter = useCallback(
    (type: Notification['type'], message: string) => {
      const id = Date.now() + Math.random();
      setListe((l) => [...l.slice(-3), { id, type, message }]);
      setTimeout(() => retirer(id), DUREE_AFFICHAGE_MS);
    },
    [retirer],
  );

  const notifier = useMemo<Notifier>(
    () => ({
      succes: (m) => ajouter('succes', m),
      erreur: (m) => ajouter('erreur', m),
    }),
    [ajouter],
  );

  return (
    <ContexteNotifications.Provider value={notifier}>
      {children}
      <div className="notifications" role="status" aria-live="polite">
        {liste.map((n) => (
          <div
            key={n.id}
            className={`notification${n.type === 'erreur' ? ' notification--erreur' : ''}`}
          >
            <span>
              <span className="sr-only">{n.type === 'erreur' ? 'Erreur : ' : 'Succès : '}</span>
              {n.message}
            </span>
            <button
              type="button"
              className="bouton bouton--lien bouton--petit"
              onClick={() => retirer(n.id)}
            >
              Fermer<span className="sr-only"> la notification</span>
            </button>
          </div>
        ))}
      </div>
    </ContexteNotifications.Provider>
  );
}

export function useNotifier(): Notifier {
  const contexte = useContext(ContexteNotifications);
  if (!contexte) throw new Error('useNotifier doit être utilisé dans FournisseurNotifications');
  return contexte;
}
