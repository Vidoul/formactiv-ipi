# Traçabilité

Relie les exigences (chapitre 3), les user stories (chapitre 4) et les cas d'utilisation
(chapitre 5) du dossier de conception à leur réalisation et à leur vérification. Les
identifiants (REQ, US, UC, RG) sont repris tels quels dans le code, les commits et les tests.

## Exigences → réalisation → vérification

| Exigence          | Réalisation                                                         | Vérification                                                       |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| REQ-FUNC-001/003  | 5 rôles, rôle unique, matrice RBAC (gardes + portées)               | intégration `utilisateurs`, `auth` ; E2E refus d'espace            |
| REQ-FUNC-002      | module `utilisateurs`, écran 06                                     | intégration `utilisateurs` ; tests `admin`                         |
| REQ-FUNC-004      | politique de mot de passe, verrouillage, MFA TOTP                   | unitaires `regles` ; intégration `auth` ; E2E MFA                  |
| REQ-FUNC-005      | liens à usage unique (30 min), écrans 02                            | intégration `auth` ; tests `auth`                                  |
| REQ-FUNC-006/007  | modules `formations`, `competences`, écrans 10 et 11                | intégration `catalogue` ; tests `catalogue`                        |
| REQ-FUNC-008/009  | module `sessions`, écran 12 (planification, affectations, conflits) | intégration `sessions-inscriptions`                                |
| REQ-FUNC-010      | module `inscriptions`, écran 13                                     | intégration `sessions-inscriptions` ; tests `sessions`             |
| REQ-FUNC-011      | module `evaluations`, écran 16                                      | intégration `evaluations` ; E2E saisie de note                     |
| REQ-FUNC-012      | module `documents` : PDF balisés, référence unique, écran 14        | unitaires PDF ; intégration `documents-exports` ; E2E génération   |
| REQ-FUNC-013      | parcours (écran 19), mes documents (écran 20)                       | intégration ; E2E téléchargement signé                             |
| REQ-FUNC-014      | module `exports` (CSV, PDF), page Exports                           | unitaires CSV ; intégration ; E2E export CSV                       |
| REQ-FUNC-015/016  | module `reporting`, écrans 05, 09, 17, 18, 21a                      | unitaires indicateurs ; intégration `reporting` ; tests `tableaux` |
| REQ-FUNC-017      | filtres période / formation / entreprise (RG-DASH-03)               | intégration `reporting` ; tests `tableaux`                         |
| REQ-FUNC-018      | module `entreprises`, portée client entreprise, écran 21b           | intégration ; E2E client                                           |
| REQ-TECH-001..006 | SPA + API REST séparées, PostgreSQL, monolithe modulaire            | ADR-01 à 07, [architecture](architecture/README.md)                |
| REQ-SEC-001..005  | Argon2id, OWASP Top 10, RBAC, journal, JWT                          | [sécurité](securite.md), CI (audit, CodeQL)                        |
| REQ-RGPD-001..006 | minimisation, consentement, droits, conservation                    | [RGPD](rgpd.md), intégration `rgpd-journal`, tests `rgpd`          |
| REQ-NF-003        | composants accessibles, PDF balisés                                 | axe-core (34 écrans, bureau et mobile)                             |
| REQ-NF-004        | documentation technique et utilisateur (`docs/`), OpenAPI           | —                                                                  |
| REQ-NF-005        | sobriété (architecture, front, requêtes)                            | [architecture](architecture/README.md)                             |
| REQ-NF-006        | code typé, règles en fonctions pures, 315 tests automatisés         | [tests](tests.md), CI                                              |

## User stories → écrans et routes

| US    | Intitulé (résumé)                              | Écran Figma    | Routes principales                                    |
| ----- | ---------------------------------------------- | -------------- | ----------------------------------------------------- |
| US-01 | créer, modifier, supprimer des comptes         | 06             | `/utilisateurs`                                       |
| US-02 | attribuer un rôle                              | 06             | `PATCH /utilisateurs/{id}`                            |
| US-03 | s'authentifier avec un mot de passe fort       | 01             | `/auth/login`                                         |
| US-04 | activer la double authentification             | 01, sécurité   | `/auth/mfa/*`                                         |
| US-05 | récupérer son mot de passe                     | 02             | `/auth/mot-de-passe-oublie`, `/auth/reinitialisation` |
| US-06 | créer et paramétrer une formation              | 10             | `/formations`                                         |
| US-07 | associer des compétences                       | 10             | `/formations/{id}/competences`                        |
| US-08 | gérer les référentiels de compétences          | 11             | `/competences`                                        |
| US-09 | publier ou archiver une formation              | 10             | `PATCH /formations/{id}`                              |
| US-10 | planifier des sessions                         | 12             | `/sessions`                                           |
| US-11 | affecter des formateurs                        | 12             | `/sessions/{id}/formateurs/{idFormateur}`             |
| US-12 | inscrire des apprenants                        | 13             | `POST /sessions/{id}/inscriptions`                    |
| US-13 | suivre les inscriptions                        | 13             | `/inscriptions`                                       |
| US-14 | formateur : mes sessions et inscrits           | 15             | `/sessions`, `/inscriptions`                          |
| US-15 | apprenant : sessions passées et à venir        | 18, 19         | `/reporting/apprenant`, parcours                      |
| US-16 | saisir les notes                               | 16             | `/sessions/{id}/feuille-evaluation`                   |
| US-17 | visualiser l'acquisition des compétences       | 16             | `/inscriptions/{id}/evaluations`                      |
| US-18 | apprenant : notes et compétences acquises      | 19             | `/utilisateurs/{id}/parcours`                         |
| US-19 | générer attestations et certificats            | 14             | `POST /inscriptions/{id}/documents`                   |
| US-20 | télécharger ses documents                      | 20             | `/documents`, `/documents/{id}`                       |
| US-21 | historique du parcours                         | 19             | `/utilisateurs/{id}/parcours`                         |
| US-22 | exporter en PDF et CSV                         | 14, Exports    | `/exports`                                            |
| US-23 | tableau de bord global                         | 09             | `/reporting/indicateurs`                              |
| US-24 | client : tableau de bord de ses salariés       | 21a, 21b       | `/reporting/indicateurs`, `/reporting/salaries`       |
| US-25 | formateur : tableau de bord de ses sessions    | 17             | `/reporting/formateur`                                |
| US-26 | apprenant : tableau de bord de son parcours    | 18             | `/reporting/apprenant`                                |
| US-27 | administrateur : activité de la plateforme     | 05             | `/reporting/administration`                           |
| US-28 | consentement explicite à la création du compte | activation, 04 | `/auth/activation`, `/rgpd/consentements/*`           |
| US-29 | consulter et rectifier ses données             | 04             | `/rgpd/mes-donnees`                                   |
| US-30 | demander la suppression de son compte          | 04             | `POST /rgpd/demandes`                                 |
| US-31 | traiter les demandes RGPD                      | 07             | `/rgpd/demandes`                                      |
| US-32 | consulter le journal des actions sensibles     | 08             | `/journal`                                            |

## Cas d'utilisation → modules

| UC    | Cas d'utilisation                   | Module(s)                    |
| ----- | ----------------------------------- | ---------------------------- |
| UC-01 | S'authentifier                      | `auth`                       |
| UC-02 | Récupérer son mot de passe          | `auth`, `mail`               |
| UC-03 | Gérer comptes et rôles              | `utilisateurs`, `parametres` |
| UC-04 | Gérer le catalogue                  | `formations`, `competences`  |
| UC-05 | Planifier une session               | `sessions`                   |
| UC-06 | Gérer les inscriptions              | `inscriptions`               |
| UC-07 | Consulter ses sessions              | `sessions`                   |
| UC-08 | Évaluer les apprenants              | `evaluations`                |
| UC-09 | Générer attestations et certificats | `documents`                  |
| UC-10 | Consulter son parcours              | `documents` (parcours)       |
| UC-11 | Exporter des données                | `exports`                    |
| UC-12 | Consulter son tableau de bord       | `reporting`                  |
| UC-13 | Exercer ses droits RGPD             | `rgpd`                       |
| UC-14 | Traiter les demandes RGPD           | `rgpd`, `utilisateurs`       |
| UC-15 | Consulter le journal                | `journal`                    |

## Historique Git

Chaque lot est développé sur une branche dédiée (`feat/…`, `fix/…`, `test/…`, `chore/…`,
`ci/…`, `docs/…`), en commits conventionnels référençant les identifiants du dossier, puis
fusionné dans `main` sans avance rapide (`--no-ff`) : `git log --first-parent main` donne la liste
des lots livrés. Le [CHANGELOG](../CHANGELOG.md) en fait la synthèse.
