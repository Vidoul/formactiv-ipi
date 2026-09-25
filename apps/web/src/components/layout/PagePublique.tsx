import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../auth/ContexteAuth';

/** Gabarit des pages d'information publiques (aide, accessibilité, confidentialité). */
export function PagePublique({ titre, children }: { titre: string; children: ReactNode }) {
  const { etat } = useAuth();
  useEffect(() => {
    document.title = `${titre} — FORMACTIV`;
  }, [titre]);

  return (
    <>
      <a href="#contenu" className="lien-evitement">
        Aller au contenu
      </a>
      <header className="en-tete">
        <Link to="/" className="logo" aria-label="FORMACTIV — accueil">
          FORM<span className="logo__accent">ACTIV</span>
        </Link>
        {etat.statut === 'connecte' ? (
          <Link to="/">Retour à mon espace</Link>
        ) : (
          <Link to="/connexion">Se connecter</Link>
        )}
      </header>
      <main
        id="contenu"
        className="contenu"
        tabIndex={-1}
        style={{ maxWidth: '56rem', margin: '0 auto' }}
      >
        <h1>{titre}</h1>
        {children}
      </main>
      <PiedDePage />
    </>
  );
}

export function PiedDePage() {
  return (
    <footer className="contenu" style={{ maxWidth: '56rem', margin: '0 auto' }}>
      <nav aria-label="Informations légales">
        <ul
          className="rangee"
          style={{ listStyle: 'none', padding: 0, fontSize: 'var(--taille-sm)' }}
        >
          <li>
            <Link to="/accessibilite">Accessibilité : partiellement conforme</Link>
          </li>
          <li aria-hidden="true">·</li>
          <li>
            <Link to="/confidentialite">Données personnelles</Link>
          </li>
          <li aria-hidden="true">·</li>
          <li>
            <Link to="/aide">Aide</Link>
          </li>
        </ul>
      </nav>
    </footer>
  );
}
