# ADR-07 — Génération de PDF accessibles avec pdfkit

- **Statut** : accepté
- **Date** : 2026-09-28
- **Contexte dossier** : chapitre 7 (outils complémentaires : « pdf-lib ou Playwright HTML vers
  PDF »), chapitre 11 (engagement RGAA : documents PDF balisés et lisibles par lecteur d'écran),
  chapitre 8 (sobriété).

## Contexte

Le dossier propose pdf-lib ou un rendu HTML → PDF par Playwright pour les attestations,
certificats et exports. Le chapitre 11 engage par ailleurs FORMACTIV à produire des PDF
**balisés** (structure logique, langue, titre, ordre de lecture) exploitables par les lecteurs
d'écran.

| Option                | PDF balisé (PDF/UA)            | Empreinte d'exploitation                 |
| --------------------- | ------------------------------ | ---------------------------------------- |
| pdf-lib               | non (pas d'arbre de structure) | faible                                   |
| Playwright HTML → PDF | partiel, selon Chromium        | navigateur embarqué (~300 Mo), lent      |
| **pdfkit** (retenu)   | **oui** (Document, H1, P, L…)  | faible, pur JavaScript, polices standard |

## Décision

Les documents sont produits avec **pdfkit 0.17** en PDF 1.7 balisé :

- arbre de structure (`Document`, `H1`, `H2`, `P`, `L` / `LI`, `Table` / `TR` / `TH` / `TD`) ;
- langue `fr-FR`, titre affiché à l'ouverture (`DisplayDocTitle`), métadonnées (titre, sujet,
  auteur, date de génération) ;
- éléments décoratifs (bandeau, filets, fonds d'en-tête) marqués comme artefacts ;
- tableaux d'export paginés avec en-têtes répétés, mise en page paysage ;
- polices standard PDF : aucune ressource téléchargée à la génération.

Les gabarits sont des fonctions pures (`src/modules/documents/pdf/`), réutilisées par l'API et
par le jeu de démonstration ; des tests unitaires vérifient la présence des balises.

## Conséquences

- Écart assumé avec l'outil cité au chapitre 7, au bénéfice de l'engagement d'accessibilité.
- Une vérification PDF/UA outillée (PAC, veraPDF) est prévue lors de l'audit RGAA.
