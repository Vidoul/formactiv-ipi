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

### Sécurité

- Dépendances auditées : surcharge de `deepmerge-ts` (dépendance du CLI Prisma) vers la version
  corrigée ; Nodemailer 10 et js-yaml 4.3.2 retenus pour corriger des vulnérabilités connues.
