import { vi } from 'vitest';
import { reponseJson } from './rendu';

type Gestionnaire = (corps: unknown, url: URL) => Response | Promise<Response>;

/**
 * Remplace fetch par une API simulée : clés « MÉTHODE /chemin » (sans le préfixe /api/v1).
 * Toute requête non prévue échoue explicitement pour rendre les tests lisibles.
 */
export function simulerApi(routes: Record<string, Gestionnaire | [number, unknown]>) {
  const appels: { cle: string; corps: unknown }[] = [];
  const fetchSimule = vi.fn(async (entree: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entree), 'http://localhost');
    const methode = init?.method ?? 'GET';
    const cle = `${methode} ${url.pathname.replace('/api/v1', '')}`;
    const corps = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
    appels.push({ cle, corps });
    const route = routes[cle];
    if (!route)
      return reponseJson(404, { code: 'NON_SIMULE', message: `Route non simulée : ${cle}` });
    return Array.isArray(route) ? reponseJson(route[0], route[1]) : route(corps, url);
  });
  vi.stubGlobal('fetch', fetchSimule);
  return { appels, fetchSimule };
}

export const PAS_DE_SESSION: [number, unknown] = [
  401,
  { code: 'REFRESH_ABSENT', message: 'Aucune session active.' },
];
