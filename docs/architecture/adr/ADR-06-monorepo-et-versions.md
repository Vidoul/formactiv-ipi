# ADR-06 — Monorepo npm workspaces et politique de versions

- **Statut** : accepté
- **Date** : 2026-09-25
- **Contexte dossier** : chapitre 7 (stack : un seul langage TypeScript), chapitre 8 (séparation
  front / back, REQ-TECH-003), chapitre 15 (risque R8 : vulnérabilité de dépendance).

## Contexte

Le front (React) et le back (NestJS) sont deux déployables distincts (REQ-TECH-003) mais
partagent le même langage, les mêmes conventions et le même cycle de livraison. L'équipe de
4 développeurs doit pouvoir livrer une fonctionnalité de bout en bout (API + écran + tests) dans
une seule branche, donc une seule revue.

## Décision

1. **Un dépôt unique** organisé en **npm workspaces** : `apps/api` et `apps/web`. Pas d'outil de
   monorepo supplémentaire (Nx, Turborepo) : deux applications ne le justifient pas (sobriété).
2. **Versions majeures stables et maîtrisées** plutôt que les toutes dernières majeures publiées :

   | Brique        | Version retenue | Motif                                                                                         |
   | ------------- | --------------- | --------------------------------------------------------------------------------------------- |
   | Node.js       | 24 LTS          | support long terme                                                                            |
   | TypeScript    | 5.9             | la 7.x (compilateur natif) n'est pas encore supportée par tout l'outillage (ts-jest, plugins) |
   | NestJS        | 11.x            | API stable, écosystème (swagger, throttler, schedule) aligné                                  |
   | Prisma        | 6.19            | client CommonJS compatible NestJS sans adaptateur de driver                                   |
   | React         | 19.x            | —                                                                                             |
   | Vite / Vitest | 7.x / 3.x       | —                                                                                             |
   | React Router  | 7.x             | —                                                                                             |
   | Jest          | 29.x            | aligné avec ts-jest 29                                                                        |

3. Les versions sont **épinglées** (`--save-exact`) et le `package-lock.json` est versionné
   (OWASP A08 — intégrité de la chaîne logicielle).
4. Les montées de version sont proposées automatiquement (Dependabot) et passent par la CI.

## Conséquences

- Une seule commande `npm install` à la racine ; scripts délégués par `-w apps/<app>`.
- Les montées de versions majeures (NestJS 12, TypeScript 7, Prisma 7+) font l'objet d'une
  tâche planifiée dédiée, avec passage complet de la suite de tests.
