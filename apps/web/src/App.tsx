import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { ErreurApi } from './api/client';
import { FournisseurNotifications } from './components/ui';
import { routes } from './routes';

/**
 * État serveur géré par TanStack Query (chapitre 8) : cache, invalidation après mutation,
 * pas de nouvelle tentative sur les erreurs fonctionnelles (4xx).
 */
const clientRequetes = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (tentative, erreur) =>
        !(erreur instanceof ErreurApi && erreur.status < 500) && tentative < 2,
    },
  },
});

const routeur = createBrowserRouter(routes);

export function App() {
  return (
    <QueryClientProvider client={clientRequetes}>
      <FournisseurNotifications>
        <RouterProvider router={routeur} />
      </FournisseurNotifications>
    </QueryClientProvider>
  );
}
