# Documentation FORMACTIV

Index de la documentation technique et utilisateur. Chaque document renvoie aux chapitres du
dossier de conception dont il décline la mise en œuvre.

| Domaine              | Document                                                   | Dossier de conception |
| -------------------- | ---------------------------------------------------------- | --------------------- |
| Architecture         | [architecture/README.md](architecture/README.md)           | ch. 8                 |
| Décisions (ADR)      | [architecture/adr/](architecture/adr/)                     | ch. 7-8               |
| API                  | [api/README.md](api/README.md)                             | ch. 9                 |
| Sécurité             | [securite.md](securite.md)                                 | ch. 10                |
| RGPD                 | [rgpd.md](rgpd.md)                                         | ch. 10                |
| Accessibilité (RGAA) | [accessibilite-rgaa.md](accessibilite-rgaa.md)             | ch. 11                |
| Tests                | [tests.md](tests.md)                                       | ch. 13 (DoD)          |
| Traçabilité          | [tracabilite.md](tracabilite.md)                           | ch. 3                 |
| Exploitation         | [exploitation.md](exploitation.md)                         | ch. 12                |
| Guide utilisateur    | [guides/guide-utilisateur.md](guides/guide-utilisateur.md) | ch. 5, 11             |

Spécification de l'API : [api/formactiv-openapi.yaml](api/formactiv-openapi.yaml) (générée par
`npm run openapi:export`).

## Décisions d'architecture

| ADR                                                            | Décision                              |
| -------------------------------------------------------------- | ------------------------------------- |
| [ADR-01](architecture/adr/ADR-01-api-rest.md)                  | API REST plutôt que GraphQL           |
| [ADR-02](architecture/adr/ADR-02-monolithe-modulaire.md)       | Monolithe modulaire                   |
| [ADR-03](architecture/adr/ADR-03-postgresql.md)                | PostgreSQL relationnel                |
| [ADR-04](architecture/adr/ADR-04-jwt.md)                       | JWT access / refresh, MFA TOTP        |
| [ADR-05](architecture/adr/ADR-05-stockage-des-documents.md)    | Stockage objet et URL signées         |
| [ADR-06](architecture/adr/ADR-06-monorepo-et-versions.md)      | Monorepo npm et politique de versions |
| [ADR-07](architecture/adr/ADR-07-generation-pdf-accessible.md) | PDF accessibles avec pdfkit           |

Les documents sont complétés à chaque fonctionnalité livrée (Definition of Done).
