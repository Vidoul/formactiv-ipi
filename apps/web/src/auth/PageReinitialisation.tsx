import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErreurApi } from '../api/client';
import { Alerte, Bouton } from '../components/ui';
import { motDePasseConforme } from '../utils/motDePasse';
import { CarteAuth, ChampsNouveauMotDePasse, Etapes } from './composants';
import { authApi } from './api';

/** Écran Figma 02 (étape 3) — nouveau mot de passe via le lien à usage unique. */
export default function PageReinitialisation() {
  const [parametres] = useSearchParams();
  const jeton = parametres.get('jeton') ?? '';
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [soumis, setSoumis] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurChamp, setErreurChamp] = useState<string | undefined>();
  const [termine, setTermine] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const surEnvoi = async (evenement: FormEvent) => {
    evenement.preventDefault();
    setSoumis(true);
    setErreur(null);
    setErreurChamp(undefined);
    if (confirmation !== motDePasse) return;
    if (!motDePasseConforme(motDePasse)) {
      setErreurChamp('Le mot de passe ne respecte pas tous les critères ci-dessous.');
      return;
    }
    setEnCours(true);
    try {
      await authApi.reinitialiser(jeton, motDePasse);
      setTermine(true);
    } catch (e) {
      if (e instanceof ErreurApi && e.code === 'MOT_DE_PASSE_NON_CONFORME') {
        setErreurChamp(e.erreursChamps.motDePasse ?? e.message);
      } else {
        setErreur(e instanceof ErreurApi ? e.message : 'Enregistrement impossible pour le moment.');
      }
    } finally {
      setEnCours(false);
    }
  };

  return (
    <CarteAuth titreDocument="Nouveau mot de passe" sousTitre="Récupération de mot de passe">
      <Etapes courante={3} libelle="nouveau mot de passe" />
      {!jeton && (
        <Alerte type="erreur">
          <p>Lien incomplet. Utilisez le lien reçu par email ou refaites une demande.</p>
        </Alerte>
      )}
      {erreur && (
        <Alerte type="erreur">
          <p>{erreur}</p>
          <p>
            <Link to="/mot-de-passe-oublie">Demander un nouveau lien</Link>
          </p>
        </Alerte>
      )}
      {termine ? (
        <Alerte type="succes" titre="Mot de passe enregistré">
          <p>Vos sessions ouvertes ont été fermées par sécurité.</p>
          <p>
            <Link to="/connexion">Se connecter</Link>
          </p>
        </Alerte>
      ) : (
        jeton && (
          <form onSubmit={surEnvoi} noValidate aria-label="Nouveau mot de passe">
            <ChampsNouveauMotDePasse
              libelle="Nouveau mot de passe (via le lien)"
              valeur={motDePasse}
              confirmation={confirmation}
              surValeur={setMotDePasse}
              surConfirmation={setConfirmation}
              erreurServeur={erreurChamp}
              soumis={soumis}
            />
            <Bouton type="submit" bloc chargement={enCours}>
              Enregistrer
            </Bouton>
          </form>
        )
      )}
    </CarteAuth>
  );
}
