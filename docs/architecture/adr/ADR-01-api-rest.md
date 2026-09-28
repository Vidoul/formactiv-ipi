# ADR-01 — API REST plutôt que GraphQL

- **Statut** : accepté
- **Date** : 2026-09-25
- **Contexte dossier** : chapitre 8 (ADR-01), REQ-TECH-002, REQ-ORG-004.

## Contexte

Le sujet autorise REST ou GraphQL. Les ressources de FORMACTIV (formations, sessions,
inscriptions, évaluations, documents) sont stables et bien délimitées ; une spécification
OpenAPI est exigée en livrable.

## Décision

API **REST** versionnée sous `/api/v1`, documentée par OpenAPI généré depuis le code
(`@nestjs/swagger`, export `docs/api/formactiv-openapi.yaml`).

## Conséquences

- Contrôle d'accès par ressource et mise en cache HTTP simples à sécuriser (OWASP API Security) ;
  pas de profondeur de requête ni d'autorisation par champ à maîtriser comme en GraphQL.
- Conventions communes (pagination, erreurs normalisées) décrites dans [l'API](../../api/README.md).
- Les écrans agrégés (tableaux de bord) disposent de routes dédiées (`/reporting/*`) plutôt que de
  requêtes composées côté client.
