# API FORMACTIV

API REST (ADR-01) exposée sous `/api/v1`. La spécification complète, générée depuis le code, est
dans [`formactiv-openapi.yaml`](formactiv-openapi.yaml) (importable dans Swagger Editor ou
Postman) ; en développement, l'interface interactive est servie sur `/api/docs`.

```bash
npm run openapi:export
```

## Conventions

| Sujet            | Convention                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| Authentification | `Authorization: Bearer <access token>` ; refresh par cookie `httpOnly` sur `/api/v1/auth`        |
| Droits           | matrice RBAC en refus par défaut ; objet hors portée → **404** (son existence n'est pas révélée) |
| Entrées          | JSON validé par liste blanche : tout champ inconnu est refusé (400)                              |
| Pagination       | `?page=1&limit=20` (limite max. 100) → `{ donnees, total, page, limit }`                         |
| Dates            | calendaires `AAAA-MM-JJ` (existence contrôlée) ; horodatages ISO 8601 UTC                        |
| Fichiers         | `Content-Disposition: attachment`, `Cache-Control: no-store`                                     |
| Débit            | limitation globale et renforcée sur les routes d'authentification (429)                          |
| Corrélation      | en-tête `X-Request-Id` sur chaque réponse, repris dans les erreurs et les logs                   |

### Format des erreurs

```json
{
  "statusCode": 409,
  "code": "CERTIFICAT_NON_ELIGIBLE",
  "message": "Certificat indisponible : 1 compétence(s) acquise(s) sur 2 (RG-CERT-01).",
  "details": null,
  "chemin": "/api/v1/inscriptions/3f…/documents",
  "horodatage": "2026-09-28T10:12:00.000Z",
  "idRequete": "8b1c…"
}
```

- `code` est stable et exploitable par le client ; `message` est destiné à l'utilisateur.
- Erreurs de validation (400, `VALIDATION`) : `details` liste `{ champ, messages[] }`.
- Règles de gestion violées : 409 (conflit) ou 422 ; concurrence de transactions : 409
  `CONFLIT_CONCURRENT` (réessayer).
- Les paramètres d'URL ne figurent jamais dans `chemin` ni dans les logs (liens signés, jetons).

## Routes par domaine

Rôles : ADM administrateur, RESP responsable formation, FORM formateur, APP apprenant,
CLI client entreprise ; « tous » = tout utilisateur authentifié, la portée étant appliquée par
le service.

| Domaine          | Méthode et route                                                               | Rôles                               | Référence                     |
| ---------------- | ------------------------------------------------------------------------------ | ----------------------------------- | ----------------------------- |
| Santé            | `GET /sante`                                                                   | public                              | exploitation                  |
| Authentification | `POST /auth/login`, `/auth/mfa`, `/auth/refresh`, `/auth/logout`               | public                              | UC-01, RG-AUTH-01..03         |
|                  | `POST /auth/mot-de-passe-oublie`, `/auth/reinitialisation`, `/auth/activation` | public                              | UC-02, RG-AUTH-04, RG-RGPD-01 |
|                  | `GET /auth/moi`, `PATCH /auth/mot-de-passe`, `POST /auth/mfa/*`                | tous                                | US-04                         |
| Comptes          | `GET/POST /utilisateurs`, `GET/PATCH/DELETE /utilisateurs/{id}`                | ADM, RESP (portée)                  | UC-03, RG-CPT-01/02           |
|                  | `GET /roles`, `POST /utilisateurs/{id}/activation`                             | ADM, RESP                           | US-01                         |
| Entreprises      | `GET/POST/PATCH/DELETE /entreprises[/{id}]`                                    | ADM, RESP                           | REQ-FUNC-018                  |
| Paramètres       | `GET /parametres`, `PATCH /parametres/{cle}`                                   | ADM                                 | UC-03                         |
| Catalogue        | `GET /formations`, `GET /competences`                                          | tous (publiées hors administration) | UC-04                         |
|                  | écriture formations, compétences, associations                                 | RESP                                | RG-FORM-01..03, RG-COMP-01    |
| Sessions         | `GET /sessions[/{id}]`                                                         | tous (portée)                       | UC-07                         |
|                  | écriture, affectations, `GET /formateurs/disponibilites`                       | RESP                                | UC-05, RG-SESS-01..03         |
| Inscriptions     | `GET /inscriptions[/{id}]`                                                     | tous (portée)                       | UC-06                         |
|                  | `POST /sessions/{id}/inscriptions`, `PATCH /inscriptions/{id}`                 | RESP                                | RG-INSC-01..03                |
| Évaluations      | `GET /inscriptions/{id}/evaluations`                                           | tous (portée, synthèse pour CLI)    | US-17/18                      |
|                  | saisie, correction, feuille de session                                         | FORM affecté (lecture ADM, RESP)    | UC-08, RG-EVAL-01/02          |
| Documents        | `POST /inscriptions/{id}/documents`                                            | RESP                                | UC-09, RG-CERT-01/02          |
|                  | `GET /documents`, `GET /documents/{id}` (lien signé)                           | tous (portée)                       | UC-10, ADR-05                 |
|                  | `GET /documents/{id}/fichier`                                                  | lien signé                          | ADR-05                        |
|                  | `GET /sessions/{id}/documents`                                                 | ADM, RESP, FORM                     | écran 14                      |
| Parcours         | `GET /utilisateurs/{id}/parcours`                                              | soi-même, ADM, RESP                 | RG-HIST-01                    |
| Exports          | `GET /exports?jeu=&format=`                                                    | tous (portée)                       | UC-11, RG-EXP-01              |
| Reporting        | `GET /reporting/indicateurs`                                                   | tous (portée)                       | RG-DASH-01..03                |
|                  | `GET /reporting/administration`                                                | ADM                                 | écran 05                      |
|                  | `GET /reporting/formateur` / `apprenant` / `salaries`                          | FORM / APP / CLI (+ADM, RESP)       | écrans 17, 18, 21b            |
|                  | `POST /inscriptions/{id}/satisfaction`                                         | APP                                 | RG-DASH-04                    |
| RGPD             | `GET/PATCH /rgpd/mes-donnees`, `GET /rgpd/mes-donnees/export`                  | tous                                | UC-13, RG-RGPD-02             |
|                  | `POST/DELETE /rgpd/consentements/{finalite}`                                   | tous                                | RG-RGPD-01                    |
|                  | `POST /rgpd/demandes`                                                          | tous                                | US-29, US-30                  |
|                  | `GET /rgpd/demandes`, `PATCH /rgpd/demandes/{id}`                              | ADM                                 | UC-14, RG-CPT-02              |
|                  | `POST /rgpd/conservation/purge`                                                | ADM                                 | RG-RGPD-04                    |
| Journal          | `GET /journal`                                                                 | ADM                                 | UC-15, RG-LOG-01              |

Chaque cas d'utilisation du chapitre 5 est couvert par au moins une route, et aucune route
n'existe sans cas d'utilisation source (voir [traçabilité](../tracabilite.md)).
