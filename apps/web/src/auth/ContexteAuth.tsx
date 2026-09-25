import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ErreurApi, sessionApi } from '../api/client';
import type { UtilisateurCourant } from '../api/types';
import { authApi, type Session } from './api';

export type EtatAuth =
  | { statut: 'chargement' }
  | { statut: 'anonyme'; raison?: 'expiree' | 'deconnexion' | 'mot-de-passe-modifie' }
  | { statut: 'connecte'; utilisateur: UtilisateurCourant };

interface ValeurAuth {
  etat: EtatAuth;
  connecter: (
    email: string,
    motDePasse: string,
  ) => Promise<{ mfaRequis: false } | { mfaRequis: true; jetonMfa: string }>;
  verifierMfa: (jetonMfa: string, code: string) => Promise<void>;
  deconnecter: (raison?: 'deconnexion' | 'mot-de-passe-modifie') => Promise<void>;
  mettreAJourUtilisateur: (utilisateur: UtilisateurCourant) => void;
}

const ContexteAuth = createContext<ValeurAuth | null>(null);

const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Session utilisateur côté navigateur (chapitre 10) : l'access token vit en mémoire ; au
 * chargement de l'application, la session est restaurée grâce au cookie httpOnly de refresh.
 */
export function FournisseurAuth({ children }: { children: ReactNode }) {
  const [etat, setEtat] = useState<EtatAuth>({ statut: 'chargement' });
  const client = useQueryClient();
  const restauration = useRef<Promise<boolean> | null>(null);

  const appliquerSession = useCallback((session: Session) => {
    sessionApi.definirJeton(session.accessToken);
    setEtat({ statut: 'connecte', utilisateur: session.utilisateur });
  }, []);

  const rafraichir = useCallback(async (): Promise<boolean> => {
    for (let tentative = 0; tentative < 2; tentative++) {
      try {
        appliquerSession(await authApi.rafraichir());
        return true;
      } catch (erreur) {
        // Un autre onglet vient de renouveler la session : le nouveau cookie est déjà posé.
        if (erreur instanceof ErreurApi && erreur.code === 'REFRESH_CONCURRENT') {
          await attendre(300);
          continue;
        }
        break;
      }
    }
    sessionApi.definirJeton(null);
    return false;
  }, [appliquerSession]);

  useEffect(() => {
    sessionApi.definirRafraichisseur(rafraichir);
    sessionApi.definirGestionnaireExpiration(() => {
      sessionApi.definirJeton(null);
      client.clear();
      setEtat({ statut: 'anonyme', raison: 'expiree' });
    });
    restauration.current ??= rafraichir();
    void restauration.current.then((ok) => {
      if (!ok) setEtat((e) => (e.statut === 'chargement' ? { statut: 'anonyme' } : e));
    });
    return () => {
      sessionApi.definirRafraichisseur(null);
      sessionApi.definirGestionnaireExpiration(null);
    };
  }, [rafraichir, client]);

  const connecter = useCallback<ValeurAuth['connecter']>(
    async (email, motDePasse) => {
      const reponse = await authApi.connecter(email, motDePasse);
      if (reponse.mfaRequis) return { mfaRequis: true, jetonMfa: reponse.jetonMfa };
      appliquerSession(reponse);
      return { mfaRequis: false };
    },
    [appliquerSession],
  );

  const verifierMfa = useCallback<ValeurAuth['verifierMfa']>(
    async (jetonMfa, code) => appliquerSession(await authApi.verifierMfa(jetonMfa, code)),
    [appliquerSession],
  );

  const deconnecter = useCallback<ValeurAuth['deconnecter']>(
    async (raison = 'deconnexion') => {
      await authApi.deconnecter().catch(() => undefined);
      sessionApi.definirJeton(null);
      client.clear();
      setEtat({ statut: 'anonyme', raison });
    },
    [client],
  );

  const mettreAJourUtilisateur = useCallback((utilisateur: UtilisateurCourant) => {
    setEtat({ statut: 'connecte', utilisateur });
  }, []);

  const valeur = useMemo(
    () => ({ etat, connecter, verifierMfa, deconnecter, mettreAJourUtilisateur }),
    [etat, connecter, verifierMfa, deconnecter, mettreAJourUtilisateur],
  );
  return <ContexteAuth.Provider value={valeur}>{children}</ContexteAuth.Provider>;
}

export function useAuth(): ValeurAuth {
  const contexte = useContext(ContexteAuth);
  if (!contexte) throw new Error('useAuth doit être utilisé dans FournisseurAuth');
  return contexte;
}

/** Utilisateur connecté (à utiliser sous une route protégée). */
export function useUtilisateur(): UtilisateurCourant {
  const { etat } = useAuth();
  if (etat.statut !== 'connecte') throw new Error('Aucun utilisateur connecté');
  return etat.utilisateur;
}
