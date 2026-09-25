import { Navigate, Outlet, useLocation } from 'react-router';
import type { CodeRole } from '../api/types';
import { Gabarit } from '../components/layout/Gabarit';
import { NAVIGATION } from '../components/layout/navigation';
import { usePage } from '../components/layout/ContextePage';
import { Chargement, EnTetePage } from '../components/ui';
import { useAuth, useUtilisateur } from './ContexteAuth';

export const CHEMIN_SECURITE = '/mon-compte/securite';

/**
 * Route protégée : session requise. Rappel (chapitre 8) : ce contrôle n'est qu'une commodité
 * d'affichage, la barrière de sécurité est l'API (gardes RBAC).
 */
export function RouteProtegee() {
  const { etat } = useAuth();
  const emplacement = useLocation();

  if (etat.statut === 'chargement') {
    return (
      <div className="page-auth">
        <div className="carte-auth">
          <Chargement libelle="Vérification de votre session…" />
        </div>
      </div>
    );
  }
  if (etat.statut === 'anonyme') {
    return <Navigate to="/connexion" replace state={{ depuis: emplacement.pathname }} />;
  }
  // RG-AUTH-03 : MFA obligatoire non configurée → redirection vers la configuration.
  if (etat.utilisateur.mfaEnrolementRequis && emplacement.pathname !== CHEMIN_SECURITE) {
    return <Navigate to={CHEMIN_SECURITE} replace />;
  }
  return <Outlet />;
}

/** Gabarit général alimenté par la session courante. */
export function GabaritConnecte() {
  const utilisateur = useUtilisateur();
  const { deconnecter } = useAuth();
  return <Gabarit utilisateur={utilisateur} surDeconnexion={() => void deconnecter()} />;
}

/** Restreint un groupe de routes à certains rôles (matrice RBAC, chapitre 5). */
export function ExigerRole({ roles }: { roles: CodeRole[] }) {
  const utilisateur = useUtilisateur();
  return roles.includes(utilisateur.role) ? <Outlet /> : <PageAccesRefuse />;
}

function PageAccesRefuse() {
  usePage('Accès refusé');
  return (
    <EnTetePage
      titre="Accès refusé"
      sousTitre="Cette page n’est pas accessible avec votre profil. Utilisez le menu pour naviguer dans votre espace."
    />
  );
}

/** Redirige « / » vers l'accueil du rôle, ou vers la connexion. */
export function RedirectionAccueil() {
  const { etat } = useAuth();
  if (etat.statut === 'chargement') return <Chargement />;
  if (etat.statut === 'anonyme') return <Navigate to="/connexion" replace />;
  return <Navigate to={NAVIGATION[etat.utilisateur.role].accueil} replace />;
}
