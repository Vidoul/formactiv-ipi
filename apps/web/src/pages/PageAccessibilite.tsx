import { PagePublique } from '../components/layout/PagePublique';

/**
 * Déclaration d'accessibilité (RGAA, chapitre 11 : « déclaration d'accessibilité publiée à la mise
 * en service »). L'état de conformité sera mis à jour à l'issue de l'audit de la phase 3.
 */
export default function PageAccessibilite() {
  return (
    <PagePublique titre="Déclaration d’accessibilité">
      <p>
        FORMACTIV s’engage à rendre sa plateforme accessible conformément à l’article 47 de la loi
        n° 2005-102 du 11 février 2005 et au Référentiel général d’amélioration de l’accessibilité
        (RGAA 4.1).
      </p>

      <h2>État de conformité</h2>
      <p>
        La plateforme est <strong>partiellement conforme</strong> au RGAA 4.1 dans l’attente de
        l’audit complet prévu avant la mise en service (jalon J5 du planning).
      </p>

      <h2>Mesures appliquées dès la conception</h2>
      <ul>
        <li>contrastes de couleurs d’au moins 4,5:1 pour le texte ;</li>
        <li>statuts toujours accompagnés d’un libellé, jamais portés par la couleur seule ;</li>
        <li>navigation complète au clavier, focus visible et lien d’évitement ;</li>
        <li>
          titres hiérarchisés, régions de page, champs étiquetés et erreurs reliées aux champs ;
        </li>
        <li>tableau de valeurs équivalent pour chaque graphique ;</li>
        <li>documents PDF générés avec titre, langue et structure lisibles.</li>
      </ul>

      <h2>Retour d’information et contact</h2>
      <p>
        Si vous ne parvenez pas à accéder à un contenu ou à un service, contactez le référent
        accessibilité : <a href="mailto:accessibilite@formactiv.fr">accessibilite@formactiv.fr</a>.
      </p>

      <h2>Voie de recours</h2>
      <p>
        Si vous n’obtenez pas de réponse satisfaisante, vous pouvez saisir le Défenseur des droits
        (formulaire en ligne ou courrier gratuit, sans affranchissement).
      </p>
    </PagePublique>
  );
}
