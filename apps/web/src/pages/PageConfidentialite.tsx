import { PagePublique } from '../components/layout/PagePublique';

/**
 * Mentions d'information RGPD (articles 13-14) : finalités, bases légales, durées de conservation,
 * droits. Reprend le registre des traitements du chapitre 10 du dossier de conception.
 * Les durées marquées [À VALIDER] dans le dossier sont paramétrables par l'administrateur.
 */
export default function PageConfidentialite() {
  return (
    <PagePublique titre="Protection de vos données personnelles">
      <p>
        FORMACTIV, organisme de formation, est responsable des traitements de données réalisés sur
        cette plateforme. Seules les données nécessaires sont collectées : nom, prénom, adresse
        email professionnelle ou personnelle, rôle, entreprise de rattachement et données de
        parcours de formation. Aucune date de naissance, adresse postale ni téléphone.
      </p>

      <h2>Finalités et bases légales</h2>
      <div className="tableau-conteneur">
        <table className="tableau">
          <caption>Registre des traitements de la plateforme</caption>
          <thead>
            <tr>
              <th scope="col">Traitement</th>
              <th scope="col">Finalité</th>
              <th scope="col">Base légale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Gestion des comptes</th>
              <td>Accès sécurisé à la plateforme</td>
              <td>Exécution du contrat de formation</td>
            </tr>
            <tr>
              <th scope="row">Gestion des parcours</th>
              <td>Suivi pédagogique, attestations et certificats</td>
              <td>Contrat ; obligations légales des organismes de formation</td>
            </tr>
            <tr>
              <th scope="row">Reporting entreprises</th>
              <td>Information de l’employeur sur la formation de ses salariés</td>
              <td>Intérêt légitime / contrat</td>
            </tr>
            <tr>
              <th scope="row">Journalisation</th>
              <td>Sécurité et imputabilité des actions sensibles</td>
              <td>Intérêt légitime</td>
            </tr>
            <tr>
              <th scope="row">Satisfaction</th>
              <td>Amélioration des formations</td>
              <td>Consentement (retirable à tout moment)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Durées de conservation</h2>
      <ul>
        <li>comptes inactifs : anonymisation 3 ans après la dernière connexion ;</li>
        <li>journal d’audit : 12 mois ;</li>
        <li>réponses de satisfaction : 24 mois, puis anonymisation (statistiques conservées) ;</li>
        <li>attestations et certificats : conservation longue au bénéfice de l’apprenant.</li>
      </ul>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d’un droit d’accès, de rectification et d’effacement de vos données, que vous
        pouvez exercer directement depuis la page « Mes données (RGPD) » de votre espace. La
        suppression d’un compte ayant un historique de formation entraîne l’effacement des données
        personnelles et l’anonymisation de l’historique statistique. Vous pouvez également
        introduire une réclamation auprès de la CNIL.
      </p>

      <h2>Sécurité et hébergement</h2>
      <p>
        Les données sont hébergées dans l’Union européenne, chiffrées en transit et au repos ; les
        mots de passe ne sont jamais conservés en clair.
      </p>
    </PagePublique>
  );
}
