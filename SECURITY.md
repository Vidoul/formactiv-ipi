# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas ouvrir d'issue publique**. Signalez toute vulnérabilité de façon privée via la
fonctionnalité « Report a vulnerability » (GitHub Security Advisories) du dépôt, en précisant :

- la version ou le commit concerné ;
- le scénario de reproduction ;
- l'impact estimé (confidentialité, intégrité, disponibilité, données personnelles).

Un accusé de réception est envoyé sous 72 h ouvrées. Toute faille touchant des données
personnelles déclenche la procédure de notification RGPD (article 33).

## Engagements

Les mesures de sécurité appliquées (OWASP Top 10, RBAC, journalisation, RGPD) sont décrites dans
[docs/securite.md](docs/securite.md). En résumé :

- mots de passe hashés en **Argon2id**, jamais stockés ni journalisés en clair ;
- authentification JWT (access 15 min + refresh révocable en cookie `httpOnly`), MFA TOTP ;
- contrôle d'accès par rôle **côté API**, refus par défaut ;
- journal des actions sensibles en écriture seule ;
- dépendances auditées en CI (`npm audit`) et mises à jour via Dependabot.

## Secrets

Aucun secret n'est versionné. Les fichiers `.env.example` ne contiennent que des valeurs de
développement factices. En production, les secrets sont injectés par l'hébergeur (coffre /
variables d'environnement) et **doivent** être régénérés (`JWT_*_SECRET`, `MFA_ENCRYPTION_KEY`,
`DOCUMENT_URL_SECRET`).
