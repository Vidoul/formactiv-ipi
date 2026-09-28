# Sécurité

Mise en œuvre du chapitre 10 du dossier de conception (REQ-SEC-001 à 005). Signalement d'une
vulnérabilité : voir [SECURITY.md](../SECURITY.md).

## Authentification et sessions

| Mesure                    | Mise en œuvre                                                                                                                                            | Règle       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Hachage des mots de passe | Argon2id (m = 19 456 Kio, t = 2, p = 1), jamais de mot de passe en clair ni en log                                                                       | REQ-SEC-001 |
| Politique de mot de passe | 12 caractères min., 4 classes, liste locale de mots de passe courants, contrôle k-anonymat optionnel                                                     | RG-AUTH-01  |
| Verrouillage              | 5 échecs → verrouillage 15 min (paramétrables), message générique anti-énumération                                                                       | RG-AUTH-02  |
| Double authentification   | TOTP obligatoire ADMIN et RESP (paramétrable), secret chiffré AES-256-GCM, anti-rejeu du pas de temps                                                    | RG-AUTH-03  |
| Liens à usage unique      | réinitialisation 30 min, activation 72 h ; seule l'empreinte SHA-256 est stockée                                                                         | RG-AUTH-04  |
| Jetons                    | access JWT 15 min en mémoire ; refresh opaque en cookie `httpOnly` `Secure` `SameSite=Strict`, rotation et révocation de famille en cas de réutilisation | ADR-04      |
| Invalidation immédiate    | chaque requête recharge le compte : désactivation, anonymisation, changement de rôle ou de mot de passe ferment les sessions                             | —           |

## OWASP Top 10 (2021)

| Risque                                 | Contre-mesures                                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 Contrôle d'accès défaillant        | gardes globales en refus par défaut, matrice RBAC par route, portées appliquées dans les requêtes (404 hors portée), refus journalisés, URL de documents signées et revérifiées |
| A02 Défaillances cryptographiques      | Argon2id, AES-256-GCM (IV aléatoire, authentification), HMAC-SHA256, secrets hors dépôt validés au démarrage (refus des secrets de développement en production), HSTS           |
| A03 Injection                          | Prisma paramétré (requêtes brutes en gabarits paramétrés), DTO en liste blanche, clés de stockage générées et contrôlées, CSV protégé contre l'injection de formules            |
| A04 Conception non sécurisée           | règles de gestion en fonctions pures testées, transactions sérialisables (capacité), minimisation par rôle                                                                      |
| A05 Mauvaise configuration             | helmet (CSP, frameguard, nosniff, referrer), CORS restreint, corps limité à 100 ko, Swagger désactivable, Nginx durci                                                           |
| A06 Composants vulnérables             | versions épinglées, `npm audit` en CI, Dependabot, CodeQL                                                                                                                       |
| A07 Identification et authentification | voir ci-dessus : MFA, verrouillage, limitation de débit renforcée sur `/auth`, messages génériques                                                                              |
| A08 Intégrité des données              | empreinte SHA-256 des PDF vérifiée à chaque remise, verrou de dépendances, journal non modifiable (trigger)                                                                     |
| A09 Journalisation et surveillance     | journal d'audit RG-LOG-01 (qui, quoi, quand, objet, IP), identifiant de corrélation, aucun secret ni paramètre d'URL journalisé                                                 |
| A10 SSRF                               | aucune URL fournie par l'utilisateur n'est appelée ; Nodemailer sans accès fichiers ni URL ; liens construits depuis `WEB_URL`                                                  |

## Journal d'audit (REQ-SEC-004, RG-LOG-01)

- Actions tracées : connexions (succès, échecs, verrouillages, MFA), comptes et rôles,
  paramètres, catalogue, sessions, inscriptions, notes (ancienne valeur conservée), documents
  (génération, téléchargement, anomalie d'intégrité), exports, consentements, demandes RGPD,
  purges de conservation, accès refusés.
- Écriture seule : aucune méthode de modification côté application ; en base, un trigger
  interdit `UPDATE` et n'autorise `DELETE` que sur les entrées de plus de 6 mois (purge).
- Assainissement défensif des détails (motifs de hachés, JWT et « mot de passe = … » masqués).
- Consultation réservée à l'administrateur (`GET /journal`, écran 08).

## Données et secrets

- Configuration validée par schéma au démarrage (`src/config/environnement.ts`) ; en production :
  cookies `Secure` obligatoires et refus des secrets de développement.
- Secrets à générer par environnement (voir [exploitation](exploitation.md)) ; aucun secret dans
  le dépôt ; `.env*` ignorés par Git et par le contexte Docker.
- Champs sensibles (hachés, secrets MFA, empreintes) retirés de toute réponse par un
  intercepteur global, en plus des sélections explicites des services.

## Vérification

- Tests d'intégration dédiés : verrouillage, MFA et anti-rejeu, rotation et vol de refresh
  token, refus RBAC journalisés, portées, liens signés falsifiés ou expirés, fichier altéré.
- Tests de bout en bout : enrôlement MFA réel, refus d'un espace d'un autre rôle.
- CI : audit des dépendances et analyse CodeQL « security-extended ».
