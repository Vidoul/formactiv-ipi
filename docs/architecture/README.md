# Architecture de FORMACTIV

Mise en œuvre du chapitre 8 du dossier de conception : application trois tiers, API REST
(ADR-01), monolithe modulaire (ADR-02), PostgreSQL (ADR-03), JWT access/refresh compatible OIDC
(ADR-04), documents en stockage objet (ADR-05). Les décisions sont consignées dans
[`adr/`](adr/).

## Vue d'ensemble

| Couche       | Technologie                                        | Emplacement       |
| ------------ | -------------------------------------------------- | ----------------- |
| Présentation | React 19, Vite 7, React Router 7, TanStack Query 5 | `apps/web`        |
| API          | NestJS 11 (Node 24), REST `/api/v1`, OpenAPI       | `apps/api`        |
| Données      | PostgreSQL 18, Prisma 6 (migrations versionnées)   | `apps/api/prisma` |
| Documents    | Stockage objet S3 (PROD) ou dossier local (DEV)    | ADR-05            |
| Tests E2E    | Playwright, axe-core                               | `e2e`             |

Toutes les règles de gestion et le contrôle d'accès sont appliqués côté API : le front n'est
qu'une commodité d'affichage, jamais une barrière de sécurité.

## C4 — niveau 1 : contexte

```mermaid
flowchart LR
  admin([Administrateur])
  resp([Responsable formation])
  form([Formateur])
  app([Apprenant])
  client([Client entreprise])
  sys[FORMACTIV<br/>plateforme web de gestion<br/>des formations et compétences]
  mail[(Serveur SMTP)]
  s3[(Stockage objet S3<br/>hébergeur UE)]
  hibp[(API k-anonymat<br/>mots de passe compromis)]

  admin & resp & form & app & client -->|HTTPS| sys
  sys -->|liens d'activation et de réinitialisation| mail
  sys -->|attestations et certificats PDF| s3
  sys -. optionnel, RG-AUTH-01 .-> hibp
```

## C4 — niveau 2 : conteneurs

```mermaid
flowchart LR
  nav[Navigateur<br/>SPA React]
  subgraph hebergement[Hébergement - docker-compose.prod.yml]
    web[web<br/>Nginx : fichiers statiques<br/>+ relais /api]
    api[api<br/>NestJS - API REST]
    db[(postgres<br/>PostgreSQL 18<br/>réseau interne)]
    mig[migration<br/>prisma migrate deploy<br/>+ administrateur initial]
  end
  s3[(Stockage objet S3)]
  smtp[(SMTP)]

  nav -->|HTTPS, même origine| web
  web -->|/api/v1| api
  api --> db
  mig --> db
  api --> s3
  api --> smtp
```

Front et API sont servis sur la **même origine** : le cookie du refresh token (`httpOnly`,
`SameSite=Strict`, chemin `/api/v1/auth`) fonctionne sans CORS ; l'access token (15 min) reste
en mémoire du navigateur.

## C4 — niveau 3 : composants de l'API

Un module NestJS par domaine métier, aux frontières étanches (extractibles en service séparé en
V2, REQ-TECH-006) :

| Module          | Responsabilité                                            | Cas d'utilisation |
| --------------- | --------------------------------------------------------- | ----------------- |
| `auth`          | connexion, MFA TOTP, jetons, récupération et activation   | UC-01, UC-02      |
| `utilisateurs`  | comptes, rôle unique, anonymisation                       | UC-03             |
| `entreprises`   | entreprises clientes (SIRET contrôlé)                     | REQ-FUNC-018      |
| `competences`   | référentiels RNCP et interne                              | UC-04             |
| `formations`    | catalogue et cycle de publication                         | UC-04             |
| `sessions`      | planification, affectation des formateurs, conflits       | UC-05, UC-07      |
| `inscriptions`  | inscriptions, capacité, cycle de statuts                  | UC-06             |
| `evaluations`   | notes, acquisition des compétences, feuille de session    | UC-08             |
| `documents`     | attestations et certificats PDF, stockage, parcours       | UC-09, UC-10      |
| `exports`       | exports CSV et PDF limités à la portée du rôle            | UC-11             |
| `reporting`     | indicateurs, tableaux de bord, satisfaction               | UC-12             |
| `rgpd`          | droits des personnes, demandes, politique de conservation | UC-13, UC-14      |
| `journal`       | journal d'audit en écriture seule et consultation         | UC-15             |
| `parametres`    | paramètres plateforme (seuils, durées, MFA obligatoire)   | UC-03             |
| `mail`, `sante` | messagerie, supervision                                   | —                 |

Chaîne de traitement d'une requête :

```mermaid
flowchart LR
  r[Requête] --> h[helmet, CORS,<br/>limite 100 ko] --> ctx[Contexte de requête<br/>IP, identifiant]
  ctx --> t[Limitation de débit] --> a[Authentification JWT<br/>+ rechargement du compte]
  a --> rb[RBAC<br/>refus par défaut] --> m[MFA obligatoire]
  m --> v[Validation DTO<br/>liste blanche] --> s[Service métier<br/>portée RBAC en requête]
  s --> db[(Prisma)]
  s --> j[Journal d'audit]
  s --> f[Filtre d'erreurs<br/>format normalisé]
```

Les portées de la matrice RBAC (« ses sessions », « son entreprise », « son parcours ») sont
traduites en filtres de requête (`common/auth/portees.ts`) : un objet hors portée n'est jamais
chargé et l'API répond 404 plutôt que 403 (OWASP A01).

## Flux principaux

### Authentification avec MFA (UC-01)

```mermaid
sequenceDiagram
  actor U as Utilisateur
  participant W as Front
  participant A as API
  participant D as PostgreSQL
  U->>W: email + mot de passe
  W->>A: POST /auth/login
  A->>D: compte, verrouillage (RG-AUTH-02)
  alt MFA activée
    A-->>W: jeton MFA temporaire (5 min)
    U->>W: code TOTP
    W->>A: POST /auth/mfa
    A->>D: vérification, anti-rejeu du pas de temps
  end
  A->>D: refresh token (empreinte SHA-256, famille)
  A-->>W: access token (15 min) + cookie refresh httpOnly
  A->>D: journal CONNEXION_REUSSIE
```

### Génération d'un certificat (UC-09)

```mermaid
sequenceDiagram
  actor R as Responsable formation
  participant A as API
  participant D as PostgreSQL
  participant S as Stockage objet
  R->>A: POST /inscriptions/{id}/documents {type}
  A->>D: inscription dans la portée, compétences acquises
  A->>A: RG-CERT-01 (terminée, toutes compétences)
  A->>A: PDF balisé, référence C-AAAA-NNNN, empreinte SHA-256
  A->>S: dépôt documents/AAAA/uuid.pdf
  A->>D: document + journal (transaction)
  Note over A,S: échec d'enregistrement : objet supprimé (UC-09 E1)
  A-->>R: document émis
```

## Déploiement cible

`docker-compose.prod.yml` (voir [exploitation](../exploitation.md)) : Nginx seul exposé derrière
le reverse proxy TLS de l'hébergeur, API en système de fichiers en lecture seule avec un
utilisateur non privilégié, base sur un réseau interne, migrations appliquées par une tâche
dédiée à chaque déploiement.

## Sobriété et impact écologique (REQ-NF-005)

- Monolithe modulaire unique : pas d'orchestration ni de trafic réseau interne superflus.
- Front découpé par route (chargement différé), bibliothèques isolées et mises en cache
  longtemps, aucune police ni ressource tierce ; graphiques en SVG natif, sans bibliothèque.
- Pagination systématique des listes, sélection des seules colonnes utiles (Prisma `select`).
- Exports et périodes d'analyse bornés (5 000 inscriptions, trois ans).
- Documents stockés hors base (sauvegardes légères), PDF en polices standard.
