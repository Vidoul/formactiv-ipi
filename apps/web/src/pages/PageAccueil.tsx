import { Link } from 'react-router';
import { useUtilisateur } from '../auth/ContexteAuth';
import { usePage } from '../components/layout/ContextePage';
import { NAVIGATION } from '../components/layout/navigation';
import { Carte, EnTetePage } from '../components/ui';

/**
 * Accueil générique de l'espace (écran Figma 03 : « Bienvenue » et raccourcis). Remplacé par le
 * tableau de bord propre à chaque profil au fil des lots (RG-DASH-02).
 */
export default function PageAccueil() {
  const utilisateur = useUtilisateur();
  const espace = NAVIGATION[utilisateur.role];
  usePage('Tableau de bord');

  return (
    <>
      <EnTetePage
        titre={`Bienvenue, ${utilisateur.prenom}`}
        sousTitre={`${espace.espace} — accédez rapidement aux fonctionnalités de votre profil.`}
      />
      <Carte titre="Raccourcis">
        <ul className="rangee" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {espace.liens
            .filter((l) => l.chemin !== espace.accueil)
            .map((lien) => (
              <li key={lien.chemin}>
                <Link to={lien.chemin} className="bouton bouton--secondaire">
                  {lien.libelle}
                </Link>
              </li>
            ))}
        </ul>
      </Carte>
    </>
  );
}
