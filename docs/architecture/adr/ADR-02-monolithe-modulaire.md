# ADR-02 — Monolithe modulaire plutôt que microservices

- **Statut** : accepté
- **Date** : 2026-09-25
- **Contexte dossier** : chapitre 8 (ADR-02), REQ-TECH-006, REQ-NF-002, REQ-NF-005.

## Contexte

Volumétrie modérée (environ 1 200 apprenants par an, 2 500 documents), équipe de quatre
développeurs, exigence de sobriété.

## Décision

Un seul déployable NestJS découpé en modules métier étanches (`auth`, `utilisateurs`,
`formations`, `sessions`, `inscriptions`, `evaluations`, `documents`, `exports`, `reporting`,
`rgpd`, `journal`…). Les modules communiquent par injection de services, jamais par accès direct
aux tables d'un autre domaine hors lecture.

## Conséquences

- Pas de réseau, d'orchestration ni de surface d'attaque supplémentaires.
- Réversibilité : les frontières suivent les domaines ; un module peut être extrait en V2
  (emplois du temps, contrats) si la charge l'exige.
- Exemple de découplage : l'anonymisation d'un compte (module `utilisateurs`) appelle les
  « nettoyeurs » enregistrés par les autres modules (PDF nominatifs du module `documents`).
