# ADR-03 — PostgreSQL relationnel

- **Statut** : accepté
- **Date** : 2026-09-25
- **Contexte dossier** : chapitre 7 (comparatif 4), chapitre 6 (MCD / MLD), REQ-TECH-004.

## Contexte

Le modèle de données est fortement relationnel (inscriptions, évaluations, compétences,
documents) et porte des règles d'intégrité (unicité, bornes de notes, dates de sessions).

## Décision

**PostgreSQL 18** accédé par **Prisma 6** (typage de bout en bout, migrations versionnées). Les
contraintes non exprimables en Prisma sont écrites dans la migration initiale : contraintes
CHECK (notes 0..20, dates de session, capacité, score 1..5, code RNCP), unicité insensible à la
casse des emails, trigger rendant le journal d'audit non modifiable.

## Conséquences

- Intégrité garantie par la base, en défense en profondeur des règles applicatives.
- Accès concurrents maîtrisés : transactions sérialisables pour la capacité des sessions
  (RG-SESS-03), conflits signalés en 409.
- Noms de tables et de colonnes identiques au MLD (contrat de nommage du chapitre 5).
