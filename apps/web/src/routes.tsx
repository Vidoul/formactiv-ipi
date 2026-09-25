import { Navigate, type RouteObject } from 'react-router';

/**
 * Chargement différé des pages (code splitting) : seule la page consultée est téléchargée
 * (sobriété, chapitre 8 : « SPA avec code splitting »).
 */
function page(
  chargeur: () => Promise<{ default: React.ComponentType }>,
): Pick<RouteObject, 'lazy'> {
  return { lazy: () => chargeur().then((m) => ({ Component: m.default })) };
}

export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/aide" replace /> },
  { path: '/aide', ...page(() => import('./pages/PageAide')) },
  { path: '/accessibilite', ...page(() => import('./pages/PageAccessibilite')) },
  { path: '/confidentialite', ...page(() => import('./pages/PageConfidentialite')) },
  { path: '*', ...page(() => import('./pages/PageIntrouvable')) },
];
