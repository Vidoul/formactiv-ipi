# Accessibilité (RGAA)

Mise en œuvre du chapitre 11 (REQ-NF-003, REQ-ORG-005). Niveau visé : conformité RGAA aux
critères de niveaux A et AA ; périmètre d'audit à confirmer avec FORMACTIV [À VALIDER].

## Engagements tenus dans le code

| Thème RGAA               | Mise en œuvre                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Images                | graphiques SVG masqués aux technologies d'assistance et doublés d'un tableau de valeurs ; QR code MFA avec alternative et clé en texte |
| 3. Couleurs              | contrastes des jetons de couleur vérifiés (≥ 4,5:1) ; badges et barres toujours accompagnés d'un texte                                 |
| 5. Tableaux              | `<caption>`, en-têtes `th` avec `scope`, en-têtes de ligne ; tableaux débordants focalisables pour défiler au clavier                  |
| 7. Scripts               | fenêtres modales Radix (piège et retour du focus, Échap, titre et description annoncés), notifications en région `aria-live`           |
| 8. Éléments obligatoires | langue `fr`, titre de page unique par écran (« Titre — FORMACTIV »)                                                                    |
| 9. Structuration         | un `h1` par page, hiérarchie de titres, régions (en-tête, navigation, contenu, pied de page)                                           |
| 10. Présentation         | mise en page fluide jusqu'à 320 px, sans perte d'information ; focus visible                                                           |
| 11. Formulaires          | étiquettes associées, indices et erreurs reliés par `aria-describedby`, `aria-invalid`, champs obligatoires signalés, `autocomplete`   |
| 12. Navigation           | lien d'évitement, fil d'Ariane, menu constant par rôle, focus placé sur le titre à chaque changement de page                           |
| 13. Consultation         | documents PDF **balisés** (ADR-07) : structure, langue, titre, décors en artefacts                                                     |

Le règlement ESLint `jsx-a11y` (configuration stricte) s'applique à tout le front ; toute
exception est locale et motivée dans le code.

## Vérifications automatisées

- **Tests unitaires du front** (Testing Library) : interactions par rôles et noms accessibles.
- **Audit axe-core** (WCAG 2.1 A/AA) dans les tests de bout en bout : 34 écrans — publics et de
  chaque profil — en affichage **bureau et mobile**, à chaque exécution de la CI. L'audit exige
  qu'un nombre significatif de règles ait été évalué (garde-fou contre un audit vide).
- Défaut trouvé et corrigé grâce à cet audit : conteneurs de tableaux défilants non atteignables
  au clavier sur mobile (WCAG 2.1.1).

## Vérifications manuelles à mener

L'audit automatique ne couvre qu'environ un tiers des critères. Avant mise en production :
parcours complets au clavier seul, lecteurs d'écran (NVDA + Firefox, VoiceOver + Safari),
zoom 200 % et 400 %, espacement du texte, lecture des PDF générés (outil PAC ou veraPDF),
puis publication de la déclaration d'accessibilité (page `/accessibilite`) avec le taux de
conformité mesuré.
