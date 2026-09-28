# Journal des modifications

Toutes les évolutions notables de FORMACTIV sont consignées ici.
Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) — versionnage
[SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- Initialisation du monorepo (npm workspaces `apps/*`), conventions de code (EditorConfig,
  Prettier), hooks Git (Husky, lint-staged, commitlint), environnement Docker de développement
  (PostgreSQL, Mailpit), documents de gouvernance (CONTRIBUTING, SECURITY).
- **API — socle technique (Sprint 0)** : NestJS 11, configuration validée au démarrage,
  en-têtes de sécurité, CORS restreint, limitation de débit, erreurs normalisées, sonde
  `/api/v1/sante`, documentation OpenAPI générée (`/api/docs`, export YAML).
- **Modèle de données** : schéma Prisma des 15 entités du dictionnaire de données + tables
  techniques, migration initiale avec contraintes CHECK (RG-SESS-01/03, notes, RG-COMP-01) et
  journal en écriture seule (trigger PostgreSQL, RG-LOG-01).
- Jeu de données de démonstration (personas des maquettes Figma, dates relatives) et mode
  `production` (administrateur initial).
- Tests unitaires (Jest) et d'intégration sur base PostgreSQL réelle (Supertest).
- **Web — socle (Sprint 0)** : React 19 + Vite 7, design system issu des maquettes Figma
  (contrastes RGAA vérifiés), composants accessibles (champs, tableaux, graphiques avec
  alternative textuelle, dialogues, notifications), gabarit par rôle (lien d'évitement, fil
  d'Ariane, focus au changement de page), client API (jeton en mémoire, rafraîchissement unique),
  pages Aide, Déclaration d'accessibilité et Protection des données ; tests Vitest.
- **Lot 1 — Authentification (US-03/04/05, UC-01/02)** : connexion avec verrouillage
  temporaire (RG-AUTH-02), double authentification TOTP obligatoire par rôle (RG-AUTH-03),
  JWT 15 min + refresh token rotatif révocable, réinitialisation par lien à usage unique
  (RG-AUTH-04), activation de compte avec consentement explicite (RG-RGPD-01), politique de
  mot de passe (RG-AUTH-01), gardes RBAC en refus par défaut ; écrans de connexion, MFA,
  mot de passe oublié, réinitialisation, activation et sécurité du compte.
- **Lot 1b — Comptes, rôles, entreprises, paramètres (US-01/02, UC-03, REQ-FUNC-018)** :
  création de compte avec lien d'activation, rôle unique (RG-CPT-01), portées RBAC
  (formateur : apprenants de ses sessions, client : ses salariés), changement de rôle journalisé
  avec fermeture des sessions, déverrouillage et réinitialisation MFA, suppression ou
  anonymisation selon l'historique (RG-CPT-02), entreprises clientes (SIRET contrôlé),
  paramètres plateforme administrables ; écrans Utilisateurs (Figma 06), Entreprises, Paramètres.
- **Lot 2 — Catalogue et compétences (US-06..09, UC-04)** : formations au cycle brouillon /
  publiée / archivée (RG-FORM-03), publication subordonnée aux compétences visées (RG-FORM-02),
  catalogue publié seul visible des apprenants et clients, seuil d'acquisition verrouillé après
  les premières notes, référentiels RNCP / interne (RG-COMP-01) ; écrans Figma 10 et 11.
- **Lot 3 — Sessions et inscriptions (US-10..15, UC-05/06/07)** : planification contrôlée
  (RG-SESS-01), affectation des formateurs avec conflits d'agenda et alerte « sans formateur »
  (RG-SESS-02), capacité garantie même en accès concurrent (RG-SESS-03), inscriptions uniques
  (RG-INSC-01), cycle de statuts (RG-INSC-02) et prérequis à vérifier (RG-INSC-03) ; écrans
  Figma 12 (planification), 13 (suivi des inscriptions) et 15 (Mes sessions du formateur).

### Sécurité

- Dépendances auditées : surcharge de `deepmerge-ts` (dépendance du CLI Prisma) vers la version
  corrigée ; Nodemailer 10 et js-yaml 4.3.2 retenus pour corriger des vulnérabilités connues.
