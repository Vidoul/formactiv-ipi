# FORMACTIV

Plateforme web de gestion des formations et des compétences — projet MESI, Équipe 2
(Pierre Orgeret, Charlie Bokkerink, Vincent Vidal, Sebastian Bouquet, Loris Pouzet).

> Réalisation issue du **dossier de conception v1.2** (30/07/2026) et des **maquettes
> fonctionnelles Figma** (22 écrans). Les identifiants du dossier (REQ-xx, US-xx, UC-xx, RG-xx)
> sont repris dans le code, les tests et les messages de commit pour assurer la traçabilité.

## Structure du dépôt

```
formactiv-ipi/
├── apps/
│   ├── api/        API REST NestJS + Prisma (PostgreSQL)
│   └── web/        SPA React + TypeScript (Vite)
├── docs/           documentation technique et utilisateur
├── infra/          scripts d'infrastructure (initialisation PostgreSQL, …)
└── docker-compose.yml   services de développement (PostgreSQL, Mailpit)
```

## Démarrage rapide

Prérequis : Node.js ≥ 22.12 (voir `.nvmrc`), npm ≥ 10, Docker (ou un PostgreSQL local).

```bash
npm install                              # dépendances de tout le monorepo
docker compose up -d                     # PostgreSQL (port 5433) + Mailpit (http://localhost:8025)
cp apps/api/.env.example apps/api/.env   # configuration de développement
npm run db:migrate                       # migrations versionnées Prisma
npm run db:seed                          # jeu de données de démonstration
npm run dev                              # API (:3000) + application web (http://localhost:5173)
```

- Documentation interactive de l'API (OpenAPI / Swagger) : <http://localhost:3000/api/docs>
- Sonde de disponibilité : <http://localhost:3000/api/v1/sante>

### Comptes de démonstration

Jeu de données fictif (personas des maquettes), mot de passe commun **`Demo#Formactiv2026`** :

| Profil                | Email                    |
| --------------------- | ------------------------ |
| Administrateur        | `a.dupre@formactiv.fr`   |
| Responsable formation | `nadia.rey@formactiv.fr` |
| Formateur             | `k.selle@formactiv.fr`   |
| Apprenant             | `lea.martin@mail.fr`     |
| Client entreprise     | `t.morel@oxalys.fr`      |

La double authentification est **obligatoire** pour l'administrateur et le responsable formation
(RG-AUTH-03) : à la première connexion, scannez le QR code avec une application TOTP, ou affichez
le code courant d'une clé avec `npm run totp -w apps/api -- <CLÉ>`.
Les emails (réinitialisation, activation) sont visibles dans Mailpit : <http://localhost:8025>.

### Tests

```bash
npm test                 # tests unitaires (règles de gestion, sécurité)
npm run test:e2e:api     # tests d'intégration API sur la base formactiv_test
npm run lint && npm run typecheck
```

## Documentation

| Document                           | Contenu                                             |
| ---------------------------------- | --------------------------------------------------- |
| [CONTRIBUTING.md](CONTRIBUTING.md) | flux Git, conventions de commit, Definition of Done |
| [SECURITY.md](SECURITY.md)         | signalement de vulnérabilité, engagements           |
| [CHANGELOG.md](CHANGELOG.md)       | historique des évolutions                           |
| [docs/](docs/README.md)            | architecture, API, sécurité, RGPD, RGAA, tests      |

## Licence

Projet pédagogique — tous droits réservés à l'équipe projet et à FORMACTIV.
