import { Link } from 'react-router';
import { PagePublique } from '../components/layout/PagePublique';

/** Aide en ligne : synthèse du guide utilisateur (docs/guides/guide-utilisateur.md). */
export default function PageAide() {
  return (
    <PagePublique titre="Aide">
      <p>
        FORMACTIV centralise la gestion des formations, des sessions, des inscriptions, des
        évaluations et des documents officiels. Chaque profil dispose d’un espace adapté.
      </p>

      <h2>Se connecter</h2>
      <ul>
        <li>Saisissez votre adresse email et votre mot de passe.</li>
        <li>
          Si la double authentification est activée, saisissez le code à 6 chiffres affiché par
          votre application d’authentification.
        </li>
        <li>
          Après 5 tentatives échouées, votre compte est verrouillé pendant 15 minutes par sécurité.
        </li>
        <li>
          Mot de passe oublié ? Utilisez le lien « Mot de passe oublié » : un lien valable 30
          minutes vous est envoyé par email.
        </li>
      </ul>

      <h2>Votre espace selon votre profil</h2>
      <dl className="definitions">
        <dt>Administrateur</dt>
        <dd>Comptes et rôles, demandes RGPD, journal d’audit, paramètres de la plateforme.</dd>
        <dt>Responsable formation</dt>
        <dd>
          Catalogue, référentiels de compétences, planification des sessions, inscriptions,
          attestations et certificats, exports et tableau de bord de pilotage.
        </dd>
        <dt>Formateur</dt>
        <dd>Consultation de vos sessions et saisie des évaluations de vos apprenants.</dd>
        <dt>Apprenant</dt>
        <dd>
          Suivi de votre progression, historique de parcours et téléchargement de vos documents.
        </dd>
        <dt>Client entreprise</dt>
        <dd>Suivi des formations de vos salariés et exports de bilans.</dd>
      </dl>

      <h2>Vos données personnelles</h2>
      <p>
        Depuis « Mes données (RGPD) », consultez, corrigez ou téléchargez vos données et demandez la
        suppression de votre compte. En savoir plus :{' '}
        <Link to="/confidentialite">politique de protection des données</Link>.
      </p>

      <h2>Accessibilité</h2>
      <p>
        La plateforme est utilisable au clavier et avec un lecteur d’écran. Consultez la{' '}
        <Link to="/accessibilite">déclaration d’accessibilité</Link> pour signaler une difficulté.
      </p>
    </PagePublique>
  );
}
