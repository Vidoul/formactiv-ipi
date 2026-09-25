import { useEffect, useId, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import type { UtilisateurCourant } from '../../api/types';
import { initiales } from '../../utils/formatage';
import { ROLES } from '../../utils/libelles';
import { FournisseurPage, useFilAriane } from './ContextePage';
import { LIENS_COMMUNS, NAVIGATION } from './navigation';

interface GabaritProps {
  utilisateur: UtilisateurCourant;
  surDeconnexion: () => void;
}

/**
 * Gabarit commun à tous les écrans authentifiés (écran Figma 03) : navigation latérale par
 * domaine, fil d'Ariane, profil, accès permanent à « Mes données (RGPD) ».
 * Structure RGAA : lien d'évitement (12.7), régions landmarks (12.6), titres hiérarchisés.
 */
export function Gabarit({ utilisateur, surDeconnexion }: GabaritProps) {
  return (
    <FournisseurPage>
      <ContenuGabarit utilisateur={utilisateur} surDeconnexion={surDeconnexion} />
    </FournisseurPage>
  );
}

function ContenuGabarit({ utilisateur, surDeconnexion }: GabaritProps) {
  const espace = NAVIGATION[utilisateur.role];
  const emplacement = useLocation();
  const principal = useRef<HTMLElement>(null);
  const premierRendu = useRef(true);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const idNavigation = useId();

  // Changement de page dans la SPA : le focus est placé sur le contenu principal pour que les
  // lecteurs d'écran annoncent la nouvelle page (le titre du document est mis à jour par usePage).
  useEffect(() => {
    setMenuOuvert(false);
    if (premierRendu.current) {
      premierRendu.current = false;
      return;
    }
    principal.current?.focus();
  }, [emplacement.pathname]);

  return (
    <div className="gabarit">
      <a href="#contenu" className="lien-evitement">
        Aller au contenu
      </a>
      <aside className="barre-laterale" data-ouverte={menuOuvert} id={idNavigation}>
        <div className="barre-laterale__marque">
          <Link to={espace.accueil} className="logo" aria-label="FORMACTIV — accueil de mon espace">
            FORM<span className="logo__accent">ACTIV</span>
          </Link>
          <span className="barre-laterale__espace">{espace.espace}</span>
        </div>
        <nav aria-label="Navigation principale">
          <ul>
            {espace.liens.map((lien) => (
              <li key={lien.chemin}>
                <NavLink to={lien.chemin} className="barre-laterale__lien" end>
                  {lien.libelle}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <nav className="barre-laterale__bas" aria-label="Compte et assistance">
          <ul>
            {LIENS_COMMUNS.map((lien) => (
              <li key={lien.chemin}>
                <NavLink to={lien.chemin} className="barre-laterale__lien">
                  {lien.libelle}
                </NavLink>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="barre-laterale__lien barre-laterale__bouton"
                onClick={surDeconnexion}
              >
                Déconnexion
              </button>
            </li>
          </ul>
        </nav>
      </aside>

      <div className="zone-principale">
        <header className="en-tete">
          <div className="rangee">
            <button
              type="button"
              className="bouton bouton--secondaire bouton--petit bouton-menu"
              aria-expanded={menuOuvert}
              aria-controls={idNavigation}
              onClick={() => setMenuOuvert((o) => !o)}
            >
              Menu
            </button>
            <FilAriane accueil={espace.accueil} espace={ROLES[utilisateur.role]} />
          </div>
          <MenuProfil utilisateur={utilisateur} surDeconnexion={surDeconnexion} />
        </header>
        <main id="contenu" className="contenu" ref={principal} tabIndex={-1}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function FilAriane({ accueil, espace }: { accueil: string; espace: string }) {
  const elements = useFilAriane();
  return (
    <nav className="fil-ariane" aria-label="Fil d'Ariane">
      <ol>
        <li>
          <Link to={accueil}>Accueil</Link>
        </li>
        <li>{espace}</li>
        {elements.map((e, i) =>
          i === elements.length - 1 ? (
            <li key={e.libelle} aria-current="page">
              {e.libelle}
            </li>
          ) : (
            <li key={e.libelle}>{e.chemin ? <Link to={e.chemin}>{e.libelle}</Link> : e.libelle}</li>
          ),
        )}
      </ol>
    </nav>
  );
}

function MenuProfil({ utilisateur, surDeconnexion }: GabaritProps) {
  const [ouvert, setOuvert] = useState(false);
  const idMenu = useId();
  const conteneur = useRef<HTMLDivElement>(null);

  // Fermeture à la perte de focus et par la touche Échap (motif « disclosure »).
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false);
    const surClic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener('keydown', surTouche);
    document.addEventListener('mousedown', surClic);
    return () => {
      document.removeEventListener('keydown', surTouche);
      document.removeEventListener('mousedown', surClic);
    };
  }, [ouvert]);

  const nomComplet = `${utilisateur.prenom} ${utilisateur.nom}`;
  return (
    <div ref={conteneur} style={{ position: 'relative' }}>
      <button
        type="button"
        className="profil"
        aria-expanded={ouvert}
        aria-controls={idMenu}
        onClick={() => setOuvert((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">
          {initiales(utilisateur.prenom, utilisateur.nom)}
        </span>
        <span>
          {nomComplet}
          <span className="sr-only"> — menu du compte</span>
        </span>
      </button>
      {ouvert && (
        <div
          id={idMenu}
          className="carte"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            minWidth: '14rem',
            zIndex: 20,
            padding: 'var(--espace-3)',
          }}
        >
          <p className="champ__indice" style={{ marginBottom: 'var(--espace-2)' }}>
            {utilisateur.email}
          </p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} className="pile">
            <li>
              <Link to="/mon-compte/securite" onClick={() => setOuvert(false)}>
                Sécurité du compte
              </Link>
            </li>
            <li>
              <Link to="/rgpd/mes-donnees" onClick={() => setOuvert(false)}>
                Mes données (RGPD)
              </Link>
            </li>
            <li>
              <button type="button" className="bouton bouton--lien" onClick={surDeconnexion}>
                Se déconnecter
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
