import type { CodeRole } from '@prisma/client';

/**
 * Catalogue des paramètres de la plateforme (matrice RBAC : « Paramètres plateforme » —
 * Administrateur). Ils portent les hypothèses [À VALIDER] du dossier de conception afin qu'un
 * arbitrage de FORMACTIV se traduise par un réglage, sans nouvelle livraison.
 */
export const CleParametre = {
  MFA_ROLES_OBLIGATOIRES: 'securite.mfa.roles_obligatoires',
  CONNEXION_TENTATIVES_MAX: 'securite.connexion.tentatives_max',
  CONNEXION_DUREE_VERROUILLAGE_MIN: 'securite.connexion.duree_verrouillage_minutes',
  EVALUATION_SEUIL_DEFAUT: 'evaluation.seuil_defaut',
  SESSION_ALERTE_SANS_FORMATEUR_JOURS: 'session.alerte_sans_formateur_jours',
  RGPD_VERSION_MENTIONS: 'rgpd.mentions.version',
  RGPD_CONSERVATION_COMPTES_INACTIFS_MOIS: 'rgpd.conservation.comptes_inactifs_mois',
  RGPD_CONSERVATION_JOURNAL_MOIS: 'rgpd.conservation.journal_mois',
  RGPD_CONSERVATION_SATISFACTION_MOIS: 'rgpd.conservation.satisfaction_mois',
} as const;

export type CleParametre = (typeof CleParametre)[keyof typeof CleParametre];

type DefinitionParametre =
  | { type: 'entier'; defaut: number; min: number; max: number; description: string }
  | { type: 'roles'; defaut: CodeRole[]; description: string }
  | { type: 'texte'; defaut: string; motif: RegExp; description: string };

export const CATALOGUE_PARAMETRES: Record<CleParametre, DefinitionParametre> = {
  [CleParametre.MFA_ROLES_OBLIGATOIRES]: {
    type: 'roles',
    defaut: ['ADMIN', 'RESP_FORMATION'],
    description: 'Rôles pour lesquels la double authentification est obligatoire (RG-AUTH-03).',
  },
  [CleParametre.CONNEXION_TENTATIVES_MAX]: {
    type: 'entier',
    defaut: 5,
    min: 3,
    max: 10,
    description: 'Échecs de connexion consécutifs avant verrouillage temporaire (RG-AUTH-02).',
  },
  [CleParametre.CONNEXION_DUREE_VERROUILLAGE_MIN]: {
    type: 'entier',
    defaut: 15,
    min: 5,
    max: 120,
    description: 'Durée du verrouillage temporaire du compte, en minutes (RG-AUTH-02).',
  },
  [CleParametre.EVALUATION_SEUIL_DEFAUT]: {
    type: 'entier',
    defaut: 10,
    min: 0,
    max: 20,
    description:
      "Seuil d'acquisition proposé par défaut aux nouvelles formations, sur 20 (RG-EVAL-02).",
  },
  [CleParametre.SESSION_ALERTE_SANS_FORMATEUR_JOURS]: {
    type: 'entier',
    defaut: 14,
    min: 1,
    max: 90,
    description:
      'Délai avant le début d’une session sans formateur déclenchant une alerte (RG-SESS-02).',
  },
  [CleParametre.RGPD_VERSION_MENTIONS]: {
    type: 'texte',
    defaut: 'v2.1',
    motif: /^v\d+(\.\d+)?$/,
    description: 'Version des mentions d’information présentées lors du consentement (RG-RGPD-01).',
  },
  [CleParametre.RGPD_CONSERVATION_COMPTES_INACTIFS_MOIS]: {
    type: 'entier',
    defaut: 36,
    min: 12,
    max: 120,
    description: 'Anonymisation des comptes inactifs après N mois sans connexion (RG-RGPD-04).',
  },
  [CleParametre.RGPD_CONSERVATION_JOURNAL_MOIS]: {
    type: 'entier',
    defaut: 12,
    min: 6,
    max: 60,
    description: "Durée de conservation du journal d'audit, en mois (RG-RGPD-04).",
  },
  [CleParametre.RGPD_CONSERVATION_SATISFACTION_MOIS]: {
    type: 'entier',
    defaut: 24,
    min: 6,
    max: 120,
    description: 'Anonymisation des commentaires de satisfaction après N mois (RG-RGPD-04).',
  },
};

/** Valeur par défaut sérialisée telle que stockée en base. */
export function valeurParDefaut(cle: CleParametre): string {
  const definition = CATALOGUE_PARAMETRES[cle];
  return definition.type === 'roles' ? definition.defaut.join(',') : String(definition.defaut);
}
