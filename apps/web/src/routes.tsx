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

const parcours = page(() => import('./features/documents/PageParcours'));
const pageExports = page(() => import('./features/documents/PageExports'));

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
              {
                path: '/admin/tableau-de-bord',
                ...page(() => import('./features/tableaux-de-bord/PageTableauAdministration')),
              },
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
          reserveA(
            ['RESP_FORMATION'],
            [
              {
                path: '/pilotage',
                ...page(() => import('./features/tableaux-de-bord/PagePilotage')),
              },
              { path: '/formations', ...page(() => import('./features/catalogue/PageFormations')) },
              {
                path: '/competences',
                ...page(() => import('./features/catalogue/PageCompetences')),
              },
              { path: '/sessions', ...page(() => import('./features/sessions/PageSessions')) },
              {
                path: '/sessions/nouvelle',
                ...page(() => import('./features/sessions/PagePlanificationSession')),
              },
              {
                path: '/sessions/:id',
                ...page(() => import('./features/sessions/PagePlanificationSession')),
              },
              {
                path: '/inscriptions',
                ...page(() => import('./features/sessions/PageInscriptions')),
              },
              {
                path: '/documents',
                ...page(() => import('./features/documents/PageDocumentsSession')),
              },
              { path: '/exports', ...pageExports },
            ],
          ),
          // Parcours d'un apprenant consulté par l'administration (RG-HIST-01)
          reserveA(
            ['ADMIN', 'RESP_FORMATION'],
            [{ path: '/apprenants/:id/parcours', ...parcours }],
          ),
          reserveA(
            ['FORMATEUR'],
            [
              {
                path: '/formateur/sessions',
                ...page(() => import('./features/formateur/PageMesSessions')),
              },
              {
                path: '/formateur/evaluations',
                ...page(() => import('./features/formateur/PageEvaluations')),
              },
              {
                path: '/formateur/tableau-de-bord',
                ...page(() => import('./features/tableaux-de-bord/PageTableauFormateur')),
              },
            ],
          ),
          reserveA(
            ['APPRENANT'],
            [
              {
                path: '/mon-espace',
                ...page(() => import('./features/tableaux-de-bord/PageTableauApprenant')),
              },
              { path: '/mon-parcours', ...parcours },
              {
                path: '/mes-documents',
                ...page(() => import('./features/documents/PageMesDocuments')),
              },
            ],
          ),
          reserveA(
            ['CLIENT_ENTREPRISE'],
            [
              {
                path: '/entreprise/tableau-de-bord',
                ...page(() => import('./features/tableaux-de-bord/PageTableauEntreprise')),
              },
              {
                path: '/entreprise/salaries',
                ...page(() => import('./features/tableaux-de-bord/PageSalaries')),
              },
              { path: '/entreprise/exports', ...pageExports },
            ],
          ),
        ],
      },
    ],
  },

  { path: '*', ...page(() => import('./pages/PageIntrouvable')) },
];
