# Guide utilisateur FORMACTIV

FORMACTIV centralise les formations, les sessions, les inscriptions, les évaluations et les
certificats. Chaque profil dispose d'un espace adapté ; le menu de gauche n'affiche que ce que
votre rôle permet. Ce guide suit les écrans des maquettes (numéros entre parenthèses).

## Pour tous les profils

### Première connexion

1. Ouvrez le lien d'activation reçu par email (valable 72 heures).
2. Choisissez un mot de passe d'au moins 12 caractères mêlant majuscules, minuscules, chiffres et
   caractères spéciaux, puis donnez votre accord à la gestion de votre compte. L'accord aux
   questionnaires de satisfaction est facultatif.
3. Connectez-vous avec votre adresse email et ce mot de passe (écran 01).

### Double authentification

Obligatoire pour l'administrateur et le responsable formation, facultative sinon (menu
« Sécurité du compte ») : scannez le QR code avec une application d'authentification (FreeOTP,
Google ou Microsoft Authenticator) ou saisissez la clé affichée, puis le code à 6 chiffres. Ce
code est ensuite demandé à chaque connexion. En cas de perte du téléphone, contactez
l'administrateur.

### Mot de passe oublié (écran 02)

« Mot de passe oublié ? » sur l'écran de connexion : un lien valable 30 minutes vous est envoyé.
Après 5 échecs de connexion, le compte est verrouillé 15 minutes.

### Mes données (écran 04)

Accessible en bas du menu : consultez vos informations, corrigez votre nom et votre prénom,
téléchargez l'ensemble de vos données (fichier JSON), gérez votre accord aux questionnaires de
satisfaction, et déposez une demande d'accès, de rectification (email, notes…) ou de suppression
de votre compte. L'administrateur traite les demandes ; leur état est affiché sur la même page.

## Responsable formation

- **Tableau de bord (09)** : taux de réussite, de complétion, satisfaction et inscriptions,
  comparés à la période précédente ; filtres période, formation, entreprise.
- **Formations (10)** : créez une formation (brouillon), associez ses compétences, publiez-la
  pour la rendre visible, archivez-la en fin de vie. Le seuil d'acquisition (10/20 par défaut)
  se règle par formation, avant les premières notes.
- **Compétences (11)** : référentiels RNCP (code obligatoire) et interne.
- **Sessions (12)** : planifiez les dates, le lieu et la capacité ; affectez les formateurs
  (les conflits d'agenda sont signalés, une session proche sans formateur est mise en alerte).
- **Inscriptions (13)** : inscrivez un apprenant, validez après vérification des prérequis,
  annulez ou terminez ; la capacité maximale est garantie.
- **Documents (14)** : pour chaque session, générez le certificat (toutes les compétences
  acquises) ou l'attestation (formation terminée) ; exportez la session en PDF ou les résultats
  en CSV.
- **Exports** : inscriptions, résultats ou évaluations, en CSV (tableur) ou PDF, filtrés.

## Formateur

- **Mes sessions (15)** : sessions à venir et passées, apprenants inscrits.
- **Évaluations (16)** : saisissez les notes sur 20 par compétence (virgule acceptée) ; la
  synthèse des compétences acquises se met à jour en direct. Seul le formateur affecté saisit ;
  chaque correction conserve l'ancienne valeur au journal.
- **Tableau de bord (17)** : part des compétences validées par session.

## Apprenant

- **Mon tableau de bord (18)** : progression par formation, documents disponibles, prochaines
  sessions ; donnez votre avis sur les formations terminées.
- **Mon parcours (19)** : historique complet, moyennes et progression par compétence.
- **Mes documents (20)** : téléchargez vos attestations et certificats (PDF lisibles par les
  lecteurs d'écran). Le lien de téléchargement est personnel et valable quelques minutes.

## Client entreprise

- **Tableau de bord (21a)** : indicateurs de vos seuls salariés, exports du bilan (PDF) et du
  détail (CSV).
- **Mes salariés (21b)** : avancement de chaque salarié (certificat obtenu, en cours…). Le détail
  des notes n'est pas communiqué à l'entreprise.

## Administrateur

- **Tableau de bord (05)** : comptes actifs, connexions, demandes RGPD en attente, comptes
  verrouillés, dernières actions sensibles.
- **Utilisateurs (06)** : créez un compte (un rôle unique) ; la personne reçoit son lien
  d'activation. Déverrouillez un compte, réinitialisez sa double authentification, désactivez-le
  ou supprimez-le (anonymisation automatique s'il a un historique).
- **Entreprises clientes** : raison sociale, SIRET contrôlé, contact.
- **Demandes RGPD (07)** : prenez en charge, traitez ou refusez (motif obligatoire) ; traiter une
  suppression efface le compte (données personnelles supprimées, historique anonymisé).
- **Journal d'audit (08)** : actions sensibles filtrables par utilisateur, action et période.
- **Paramètres** : tentatives avant verrouillage, durée de verrouillage, rôles soumis à la double
  authentification, seuil d'acquisition par défaut, durées de conservation.

## Accessibilité

L'application se parcourt entièrement au clavier (lien « Aller au contenu » en début de page),
s'adapte aux petits écrans et au zoom, et ses graphiques disposent d'un équivalent en tableau.
Signalez toute difficulté depuis la page « Accessibilité ».
