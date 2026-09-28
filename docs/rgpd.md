# Protection des données (RGPD)

Mise en œuvre du chapitre 10 (REQ-RGPD-001 à 006, RG-RGPD-01 à 04, RG-CPT-02). Les points
marqués **[À VALIDER]** reprennent les hypothèses du dossier à faire arbitrer par FORMACTIV.

## Registre simplifié des traitements

| Finalité                         | Données                                                           | Base légale                         | Accès                                  |
| -------------------------------- | ----------------------------------------------------------------- | ----------------------------------- | -------------------------------------- |
| Gestion du compte et du parcours | identité, email, rôle, entreprise, inscriptions, notes, documents | contrat / consentement (RG-RGPD-01) | selon la matrice RBAC                  |
| Questionnaires de satisfaction   | note 1 à 5, commentaire libre                                     | consentement facultatif             | agrégats uniquement (tableaux de bord) |
| Sécurité et traçabilité          | journal des actions (auteur, action, objet, IP, date)             | intérêt légitime                    | administrateur                         |

Seules les données du dictionnaire de données (chapitre 6) sont collectées (RG-RGPD-03) : aucune
date de naissance ni donnée sans finalité documentée.

## Minimisation par profil (REQ-RGPD-001)

- Client entreprise : ses seuls salariés, avancement synthétique **sans note détaillée**
  [À VALIDER], pas d'email des apprenants.
- Formateur : apprenants de ses sessions uniquement.
- Emails des apprenants visibles de l'administration seulement (listes, exports).
- Exports limités à la portée du rôle, colonnes réduites (RG-EXP-01).

## Consentement (REQ-RGPD-002, RG-RGPD-01)

- À l'activation du compte : case non pré-cochée pour la gestion du compte (obligatoire) et pour
  les questionnaires de satisfaction (facultatif), mentions versionnées (`rgpd.mentions.version`).
- Chaque consentement est une preuve horodatée (table `consentement`) ; un retrait renseigne
  `date_retrait` sans effacer la preuve. Tout don ou retrait est journalisé.
- Le consentement facultatif peut être donné au moment de répondre à un questionnaire, ou
  géré à tout moment depuis « Mes données ».

## Droits des personnes (REQ-RGPD-003 à 005, RG-RGPD-02)

| Droit         | Parcours                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Accès         | écran « Mes données » (`GET /rgpd/mes-donnees`) : compte, consentements, inscriptions, notes, documents, avis, demandes |
| Portabilité   | « Télécharger mes données » : export JSON (journalisé)                                                                  |
| Rectification | nom et prénom en libre-service ; autres données (email, notes) par demande à l'administration                           |
| Suppression   | demande depuis « Mes données », traitée par l'administrateur (écran 07)                                                 |

Traitement d'une suppression (RG-CPT-02) : un compte **sans historique** est supprimé ; un compte
avec historique est **anonymisé** — identité, email, secrets, sessions et commentaires libres
effacés, PDF nominatifs régénérés au nom « Compte Anonyme » — les inscriptions, notes et
documents restant rattachés au compte anonyme pour préserver les statistiques. Un
administrateur ne traite pas sa propre demande.

## Conservation (REQ-RGPD-006, RG-RGPD-04) [À VALIDER]

| Catégorie                      | Durée par défaut (paramètre)                                                    | Sort à l'échéance                                    |
| ------------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Comptes inactifs               | 36 mois après la dernière connexion (`rgpd.conservation.comptes_inactifs_mois`) | anonymisation ou suppression (hors administrateurs)  |
| Journal d'audit                | 12 mois, 6 mois minimum (`rgpd.conservation.journal_mois`)                      | purge                                                |
| Réponses de satisfaction       | 24 mois (`rgpd.conservation.satisfaction_mois`)                                 | commentaire effacé, note conservée pour les agrégats |
| Attestations et certificats    | conservation longue (valeur probante)                                           | archivage                                            |
| Fichiers orphelins du stockage | 24 h après leur remplacement                                                    | suppression                                          |

La purge s'exécute le 1er de chaque mois à 3 h (heure de Paris) et peut être déclenchée par
l'administrateur (`POST /rgpd/conservation/purge`) ; chaque exécution est journalisée avec ses
compteurs. Les preuves de consentement des comptes anonymisés suivent la durée de prescription
applicable [À VALIDER] : leur purge sera ajoutée une fois cette durée arbitrée.

## Sécurité des données

Chiffrement en transit (HTTPS, HSTS), secrets MFA chiffrés, documents dans un stockage objet
privé hébergé dans l'UE, contrôle d'accès et journalisation : voir [sécurité](securite.md).
