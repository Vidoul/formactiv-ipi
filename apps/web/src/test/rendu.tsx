import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import type { UtilisateurCourant } from '../api/types';
import { ContexteAuth, type ValeurAuth } from '../auth/ContexteAuth';
import { FournisseurPage } from '../components/layout/ContextePage';
import { FournisseurNotifications } from '../components/ui';

interface OptionsRendu extends RenderOptions {
  route?: string;
  /** Session simulée : le composant est rendu comme pour un utilisateur connecté. */
  utilisateur?: UtilisateurCourant;
}

/**
 * Rendu d'un composant avec les fournisseurs de l'application (requêtes, routage, notifications,
 * session éventuelle).
 */
export function rendre(
  element: ReactElement,
  { route = '/', utilisateur, ...options }: OptionsRendu = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const session: ValeurAuth | null = utilisateur
    ? {
        etat: { statut: 'connecte', utilisateur },
        connecter: vi.fn(),
        verifierMfa: vi.fn(),
        deconnecter: vi.fn(),
        mettreAJourUtilisateur: vi.fn(),
      }
    : null;
  function Fournisseurs({ children }: { children: ReactNode }) {
    const contenu = (
      <QueryClientProvider client={client}>
        <FournisseurNotifications>
          <MemoryRouter initialEntries={[route]}>
            <FournisseurPage>{children}</FournisseurPage>
          </MemoryRouter>
        </FournisseurNotifications>
      </QueryClientProvider>
    );
    return session ? (
      <ContexteAuth.Provider value={session}>{contenu}</ContexteAuth.Provider>
    ) : (
      contenu
    );
  }
  return { client, ...render(element, { wrapper: Fournisseurs, ...options }) };
}

export function utilisateurTest(surcharges: Partial<UtilisateurCourant> = {}): UtilisateurCourant {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    nom: 'Rey',
    prenom: 'Nadia',
    email: 'nadia.rey@formactiv.fr',
    role: 'RESP_FORMATION',
    mfaActive: true,
    mfaEnrolementRequis: false,
    entreprise: null,
    ...surcharges,
  };
}

/** Réponse JSON simulée pour fetch. */
export function reponseJson(status: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const pageDe = <T,>(donnees: T[]) => ({
  donnees,
  total: donnees.length,
  page: 1,
  limit: 20,
});
