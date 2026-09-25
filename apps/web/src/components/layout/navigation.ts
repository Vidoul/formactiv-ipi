import type { CodeRole } from '../../api/types';

export interface LienNavigation {
  libelle: string;
  chemin: string;
}

export interface EspaceNavigation {
  /** Libellé affiché sous le logo (« Espace Responsable formation »). */
  espace: string;
  accueil: string;
  liens: LienNavigation[];
}

/**
 * Menu latéral par domaine et par rôle (principes UX du chapitre 11, maquettes Figma 03 à 22).
 * Le menu n'est qu'une commodité : chaque route est protégée côté API par la matrice RBAC.
 */
export const NAVIGATION: Record<CodeRole, EspaceNavigation> = {
  ADMIN: {
    espace: 'Espace Administrateur',
    accueil: '/admin/tableau-de-bord',
    liens: [
      { libelle: 'Tableau de bord', chemin: '/admin/tableau-de-bord' },
      { libelle: 'Utilisateurs', chemin: '/admin/utilisateurs' },
      { libelle: 'Entreprises clientes', chemin: '/admin/entreprises' },
      { libelle: 'Demandes RGPD', chemin: '/admin/rgpd' },
      { libelle: "Journal d'audit", chemin: '/admin/journal' },
      { libelle: 'Paramètres', chemin: '/admin/parametres' },
    ],
  },
  RESP_FORMATION: {
    espace: 'Espace Responsable formation',
    accueil: '/pilotage',
    liens: [
      { libelle: 'Tableau de bord', chemin: '/pilotage' },
      { libelle: 'Formations', chemin: '/formations' },
      { libelle: 'Compétences', chemin: '/competences' },
      { libelle: 'Sessions', chemin: '/sessions' },
      { libelle: 'Inscriptions', chemin: '/inscriptions' },
      { libelle: 'Documents', chemin: '/documents' },
      { libelle: 'Exports', chemin: '/exports' },
    ],
  },
  FORMATEUR: {
    espace: 'Espace Formateur',
    accueil: '/formateur/sessions',
    liens: [
      { libelle: 'Mes sessions', chemin: '/formateur/sessions' },
      { libelle: 'Évaluations', chemin: '/formateur/evaluations' },
      { libelle: 'Tableau de bord', chemin: '/formateur/tableau-de-bord' },
    ],
  },
  APPRENANT: {
    espace: 'Espace Apprenant',
    accueil: '/mon-espace',
    liens: [
      { libelle: 'Mon tableau de bord', chemin: '/mon-espace' },
      { libelle: 'Mon parcours', chemin: '/mon-parcours' },
      { libelle: 'Mes documents', chemin: '/mes-documents' },
    ],
  },
  CLIENT_ENTREPRISE: {
    espace: 'Espace Client entreprise',
    accueil: '/entreprise/tableau-de-bord',
    liens: [
      { libelle: 'Tableau de bord', chemin: '/entreprise/tableau-de-bord' },
      { libelle: 'Mes salariés', chemin: '/entreprise/salaries' },
      { libelle: 'Exports', chemin: '/entreprise/exports' },
    ],
  },
};

/** Liens communs à tous les profils, en bas de la barre latérale. */
export const LIENS_COMMUNS: LienNavigation[] = [
  { libelle: 'Mes données (RGPD)', chemin: '/rgpd/mes-donnees' },
  { libelle: 'Aide', chemin: '/aide' },
];
