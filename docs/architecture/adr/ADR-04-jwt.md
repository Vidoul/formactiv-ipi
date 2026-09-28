# ADR-04 — Authentification JWT access / refresh, compatible OIDC

- **Statut** : accepté
- **Date** : 2026-09-25
- **Contexte dossier** : chapitre 7 (comparatif 5), chapitre 10, REQ-SEC-005, REQ-FUNC-004.

## Décision

- **Access token** JWT HS256 de 15 minutes (émetteur `formactiv-api`, audience `formactiv-web`),
  transmis en `Authorization: Bearer`, conservé en mémoire du navigateur uniquement.
- **Refresh token** opaque aléatoire (256 bits), stocké en base sous forme d'empreinte SHA-256,
  transmis dans un cookie `httpOnly`, `Secure`, `SameSite=Strict` limité à `/api/v1/auth`.
  Rotation à chaque usage ; la réutilisation d'un jeton déjà consommé révoque toute sa famille
  (vol présumé), avec une tolérance de 15 s aux requêtes concurrentes du même onglet.
- **MFA TOTP** (RFC 6238) : jeton intermédiaire distinct de 5 minutes, secret chiffré
  AES-256-GCM, anti-rejeu du pas de temps ; obligatoire pour l'administrateur et le responsable
  formation (paramétrable, RG-AUTH-03).
- Chaque requête authentifiée recharge le compte : désactivation, anonymisation ou changement de
  rôle invalident immédiatement la session.

## Conséquences

- Compatible avec l'ajout d'un fournisseur OIDC d'entreprise en V2 : la vérification des jetons
  est isolée dans le module `auth`.
- Détail des mesures : [sécurité](../../securite.md).
