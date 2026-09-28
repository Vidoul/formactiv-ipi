# Stratégie de tests

Definition of Done (chapitre 13) : une fonctionnalité est terminée lorsque ses règles de gestion
sont couvertes par des tests automatisés à chaque niveau pertinent, exécutés par la CI.

## Pyramide

| Niveau                   | Outils                           | Portée                                                                                                     | Volume                 |
| ------------------------ | -------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------- |
| Unitaires API            | Jest, ts-jest                    | règles de gestion en fonctions pures, sécurité (hachage, chiffrement, jetons), gabarits PDF, CSV, stockage | 108 tests, 21 fichiers |
| Intégration API          | Jest, Supertest, PostgreSQL réel | chaque route : droits, portées, validations, transactions, journalisation                                  | 112 tests, 10 fichiers |
| Composants et écrans web | Vitest, Testing Library, jsdom   | écrans des maquettes : rendu, interactions, appels API simulés, accessibilité des noms                     | 74 tests, 12 fichiers  |
| Bout en bout             | Playwright, axe-core             | parcours métier complet sur l'application construite, audit WCAG 2.1 A/AA bureau et mobile                 | 21 scénarios           |

Les règles de gestion sont écrites en **fonctions pures** (`*.regles.ts`) testées
unitairement, puis vérifiées de bout en bout par les tests d'intégration : RG-AUTH, RG-CPT,
RG-FORM, RG-COMP, RG-SESS, RG-INSC, RG-EVAL, RG-CERT, RG-HIST, RG-EXP, RG-DASH, RG-RGPD, RG-LOG.

## Exécution locale

Prérequis : PostgreSQL de développement (`docker compose up -d`, port 5433) ; les bases
`formactiv_test` et `formactiv_e2e` sont créées par le script d'initialisation
(`infra/postgres/init`).

```bash
npm test                     # unitaires API + tests du front
npm run test:e2e:api         # intégration API (base formactiv_test, vidée entre les tests)
npm run test:e2e             # bout en bout (base formactiv_e2e recréée et peuplée à chaque lancement)
npm run test:cov -w apps/api # couverture des tests unitaires
```

Les tests de bout en bout démarrent l'API compilée (port 3100) et le front de production
(`vite preview`, port 4173). En local, Chrome installé est utilisé ; en CI, Chromium.

## Principes

- **Base réelle** pour l'intégration : les contraintes CHECK, le trigger du journal et les
  transactions sérialisables sont réellement exercés.
- **Isolation** : base de test dédiée vidée avant chaque test ; base E2E recréée à chaque
  exécution, avec un garde-fou refusant toute base dont le nom ne se termine pas par `_e2e`.
- **Aucun secret réel** : variables de test explicites, emails conservés en mémoire, stockage
  des PDF dans un dossier temporaire.
- **MFA réelle en E2E** : la clé est lue à l'écran et le code TOTP calculé comme par une
  application d'authentification, en respectant l'anti-rejeu.
- **Sélecteurs accessibles** : les tests du front et de bout en bout ciblent les rôles et noms
  accessibles, ce qui vérifie au passage l'étiquetage des éléments.

## Intégration continue

`.github/workflows/ci.yml` : qualité (formatage, lint, types, unitaires avec couverture, tests du
front, construction), intégration (service PostgreSQL 18), bout en bout (rapport Playwright
archivé), audit des dépendances, construction des images Docker et validation de la composition
de production ; CodeQL en complément.
