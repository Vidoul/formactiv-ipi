import type { ComponentType } from 'react';
import type { RouteObject } from 'react-router';
import type { CodeRole } from './api/types';
import { ExigerRole, GabaritConnecte, RedirectionAccueil, RouteProtegee } from './auth/Protection';

/**
 * Chargement différé des pages (code splitting) : seule la page consultée est téléchargée
 * (sobriété, chapitre 8 : « SPA avec code splitting »).
 */
function page(chargeur: () => Promise<{ default: ComponentType }>): Pick<RouteObject, 'lazy'> {
  return { lazy: () => chargeur().then((m) => ({ Component: m.default })) };
}

const accueil = page(() => import('./pages/PageAccueil'));

/** Groupe de routes réservé à certains rôles (matrice RBAC, chapitre 5). */
function reserveA(roles: CodeRole[], enfants: RouteObject[]): RouteObject {
  return { element: <ExigerRole roles={roles} />, children: enfants };
}

export const routes: RouteObject[] = [
  { path: '/', element: <RedirectionAccueil /> },

  // Parcours d'authentification (écrans Figma 01 et 02)
  { path: '/connexion', ...page(() => import('./auth/PageConnexion')) },
  { path: '/mot-de-passe-oublie', ...page(() => import('./auth/PageMotDePasseOublie')) },
  { path: '/reinitialisation', ...page(() => import('./auth/PageReinitialisation')) },
  { path: '/activation', ...page(() => import('./auth/PageActivation')) },

  // Pages d'information publiques
  { path: '/aide', ...page(() => import('./pages/PageAide')) },
  { path: '/accessibilite', ...page(() => import('./pages/PageAccessibilite')) },
  { path: '/confidentialite', ...page(() => import('./pages/PageConfidentialite')) },

  // Espace connecté (gabarit Figma 03)
  {
    element: <RouteProtegee />,
    children: [
      {
        element: <GabaritConnecte />,
        children: [
          { path: '/mon-compte/securite', ...page(() => import('./auth/PageSecurite')) },
          reserveA(
            ['ADMIN'],
            [
              { path: '/admin/tableau-de-bord', ...accueil },
              {
                path: '/admin/utilisateurs',
                ...page(() => import('./features/admin/PageUtilisateurs')),
              },
              {
                path: '/admin/entreprises',
                ...page(() => import('./features/admin/PageEntreprises')),
              },
              {
                path: '/admin/parametres',
                ...page(() => import('./features/admin/PageParametres')),
              },
            ],
          ),
          reserveA(['RESP_FORMATION'], [{ path: '/pilotage', ...accueil }]),
          reserveA(['FORMATEUR'], [{ path: '/formateur/sessions', ...accueil }]),
          reserveA(['APPRENANT'], [{ path: '/mon-espace', ...accueil }]),
          reserveA(['CLIENT_ENTREPRISE'], [{ path: '/entreprise/tableau-de-bord', ...accueil }]),
        ],
      },
    ],
  },

  { path: '*', ...page(() => import('./pages/PageIntrouvable')) },
];
