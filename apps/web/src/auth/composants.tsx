import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChampTexte } from '../components/ui';
import { criteresMotDePasse, INDICE_POLITIQUE } from '../utils/motDePasse';

/** Carte centrée des écrans d'authentification (maquettes Figma 01 et 02). */
export function CarteAuth({
  titreDocument,
  sousTitre,
  children,
}: {
  titreDocument: string;
  sousTitre: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = `${titreDocument} — FORMACTIV`;
  }, [titreDocument]);

  return (
    <div className="page-auth">
      <main className="carte-auth" id="contenu">
        <div className="carte-auth__entete">
          <h1 style={{ margin: 0 }}>
            <Link to="/" className="logo" aria-label="FORMACTIV">
              FORM<span className="logo__accent">ACTIV</span>
            </Link>
          </h1>
          <p className="carte-auth__sous-titre">{sousTitre}</p>
        </div>
        {children}
      </main>
    </div>
  );
}

/** Indicateur d'étape du parcours de récupération (3 étapes, maquette 02). */
export function Etapes({ courante, libelle }: { courante: 1 | 2 | 3; libelle: string }) {
  return (
    <>
      <p className="sr-only">
        Étape {courante} sur 3 : {libelle}
      </p>
      <ol className="etapes" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <li key={n} data-faite={n <= courante} />
        ))}
      </ol>
    </>
  );
}

interface NouveauMotDePasseProps {
  valeur: string;
  confirmation: string;
  surValeur: (v: string) => void;
  surConfirmation: (v: string) => void;
  erreurServeur?: string;
  soumis: boolean;
  libelle?: string;
}

/**
 * Saisie d'un nouveau mot de passe avec retour immédiat sur la politique RG-AUTH-01 (liste de
 * critères restituée textuellement, pas seulement par la couleur) et contrôle de confirmation.
 */
export function ChampsNouveauMotDePasse({
  valeur,
  confirmation,
  surValeur,
  surConfirmation,
  erreurServeur,
  soumis,
  libelle = 'Nouveau mot de passe',
}: NouveauMotDePasseProps) {
  const criteres = criteresMotDePasse(valeur);
  const differents = soumis && confirmation !== valeur;
  return (
    <>
      <ChampTexte
        libelle={libelle}
        type="password"
        autoComplete="new-password"
        value={valeur}
        onChange={(e) => surValeur(e.target.value)}
        indice={INDICE_POLITIQUE}
        erreur={erreurServeur}
        obligatoire
      />
      <ul className="champ__indice" style={{ marginTop: '-0.5rem', paddingLeft: '1.25rem' }}>
        {criteres.map((c) => (
          <li key={c.libelle}>
            {c.respecte ? '✓' : '✗'} {c.libelle}
            <span className="sr-only">{c.respecte ? ' : respecté' : ' : non respecté'}</span>
          </li>
        ))}
      </ul>
      <ChampTexte
        libelle="Confirmer le mot de passe"
        type="password"
        autoComplete="new-password"
        value={confirmation}
        onChange={(e) => surConfirmation(e.target.value)}
        erreur={differents ? 'Les deux saisies ne correspondent pas.' : undefined}
        obligatoire
      />
    </>
  );
}
