# Contribuer à FORMACTIV

Ce document fixe les règles de travail de l'équipe (organisation SCRUM, chapitres 13 et 15 du
dossier de conception). Il s'applique à tout changement, code comme documentation.

## 1. Flux Git

- `main` est **toujours livrable** : on n'y pousse jamais directement.
- Chaque user story ou tâche technique est développée sur une branche dédiée :

  | Préfixe  | Usage                             | Exemple                         |
  | -------- | --------------------------------- | ------------------------------- |
  | `feat/`  | nouvelle fonctionnalité (US-xx)   | `feat/api-authentification`     |
  | `fix/`   | correction d'anomalie             | `fix/web-focus-modale`          |
  | `chore/` | outillage, configuration          | `chore/initialisation-monorepo` |
  | `docs/`  | documentation seule               | `docs/guide-utilisateur`        |
  | `test/`  | ajout ou refonte de tests         | `test/e2e-playwright`           |
  | `ci/`    | intégration / livraison continues | `ci/github-actions`             |

- La branche est fusionnée dans `main` par **merge commit (`--no-ff`)** après revue : l'historique
  conserve ainsi le périmètre exact de chaque fonctionnalité (`git log --first-parent main`
  donne la liste des features livrées).

## 2. Messages de commit

Format [Conventional Commits](https://www.conventionalcommits.org/fr/), vérifié automatiquement
par `commitlint` (hook `commit-msg`) :

```
<type>(<portée>): <résumé à l'impératif>

<corps : pourquoi le changement, règles de gestion / exigences concernées>
```

- Types : `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`.
- Portées autorisées : voir [`commitlint.config.mjs`](commitlint.config.mjs).
- Le corps **référence les identifiants du dossier de conception** (US-xx, UC-xx, RG-xx,
  REQ-xx) pour garantir la traçabilité exigence → code.

## 3. Definition of Done

Une user story est « terminée » lorsque (chapitre 13 du dossier) :

1. le code est revu (relecture par un autre membre) ;
2. les tests unitaires passent et **chaque règle de gestion concernée est couverte par un test** ;
3. la documentation API (OpenAPI) est à jour — elle est générée depuis le code ;
4. les critères d'accessibilité de base sont vérifiés (clavier, contrastes, libellés, axe) ;
5. la CI est verte (lint, typage, tests, build) ;
6. l'incrément est déployable en environnement de TEST.

## 4. Qualité du code

- TypeScript strict partout ; ESLint et Prettier sont exécutés en CI.
- Le hook `pre-commit` formate les fichiers indexés (`lint-staged`).
- Principes SOLID : contrôleurs fins (validation / mapping), règles métier dans les services et
  dans des fonctions pures testables (`*.rules.ts`), accès données via Prisma.
- Aucun secret dans le code : configuration par variables d'environnement validées au démarrage.

## 5. Commandes utiles

Voir le [README](README.md#démarrage-rapide).
