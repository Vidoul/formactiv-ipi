import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import type { UtilisateurCourant } from '../api/types';
import { FournisseurNotifications } from '../components/ui';

/** Rendu d'un composant avec les fournisseurs de l'application (requêtes, routage, notifications). */
export function rendre(
  element: ReactElement,
  { route = '/', ...options }: RenderOptions & { route?: string } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  function Fournisseurs({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <FournisseurNotifications>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
        </FournisseurNotifications>
      </QueryClientProvider>
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
