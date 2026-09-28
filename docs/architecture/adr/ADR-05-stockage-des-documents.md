# ADR-05 — Stockage des documents générés et téléchargement par URL signée

- **Statut** : accepté
- **Date** : 2026-09-28
- **Contexte dossier** : chapitre 8 (ADR-05), chapitre 10 (OWASP A01, A08), chapitre 12
  (environnements), RG-CERT-02, RG-HIST-01.

## Contexte

Les attestations et certificats (UC-09) sont des documents probants, conservés longtemps au
bénéfice de l'apprenant (environ 2 500 PDF par an). Ils doivent être téléchargeables par les
seuls profils autorisés (apprenant, son entreprise cliente, administration) et ne jamais être
altérés après émission.

## Décision

1. **Fichier en stockage objet, référence en base.** Le PDF est déposé dans un stockage
   compatible S3 (PROD, hébergeur UE, bucket privé) ou dans un dossier local (DEV / TEST), selon
   `STORAGE_DRIVER`. La table `document` conserve la clé de l'objet, jamais un chemin fourni par
   l'utilisateur (clé générée `documents/<année>/<uuid>.pdf`, validée par expression régulière,
   protection contre la traversée de chemin).
2. **Intégrité.** L'empreinte SHA-256 du PDF est enregistrée à la génération et vérifiée à chaque
   remise : un fichier altéré n'est pas servi (`DOCUMENT_ALTERE`) et l'anomalie est journalisée
   (`INTEGRITE_DOCUMENT`).
3. **Téléchargement en deux temps.** `GET /documents/{id}` (authentifié, portée RBAC) renvoie une
   URL signée HMAC-SHA256 valable `DOCUMENT_URL_TTL_SECONDES` (5 min par défaut) et liée à
   l'utilisateur ; `GET /documents/{id}/fichier` vérifie la signature, l'expiration, l'état du
   compte **et à nouveau la portée RBAC** avant de remettre le fichier (`Cache-Control: no-store`,
   `Content-Disposition: attachment`). Chaque remise est journalisée.
4. **Aucun document partiel.** Si l'enregistrement en base échoue après le dépôt, l'objet est
   supprimé (UC-09 E1). La numérotation `C-AAAA-NNNN` / `A-AAAA-NNNN` est optimiste : la
   contrainte d'unicité tranche les générations simultanées (trois tentatives).
5. **RGPD.** À l'anonymisation d'un apprenant (RG-CPT-02), ses PDF nominatifs sont remplacés par
   une version anonymisée (nouvelle clé, nouvelle empreinte) dans la même transaction ; les
   anciens objets deviennent orphelins et sont purgés par la tâche de conservation.

## Conséquences

- Sauvegardes de la base légères ; le stockage objet porte sa propre politique de réplication.
- Les URL signées ne sont ni journalisées ni renvoyées dans les erreurs (le filtre d'exceptions
  ne conserve que le chemin sans paramètres).
- Durée de conservation des documents : **[À VALIDER]** (RG-RGPD-04), paramétrable ultérieurement.
