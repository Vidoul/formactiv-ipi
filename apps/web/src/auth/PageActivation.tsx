import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErreurApi } from '../api/client';
import { Alerte, Bouton, CaseACocher } from '../components/ui';
import { motDePasseConforme } from '../utils/motDePasse';
import { CarteAuth, ChampsNouveauMotDePasse } from './composants';
import { authApi } from './api';

/**
 * Activation d'un compte créé par l'administration (US-28, RG-RGPD-01) : choix du mot de passe et
 * consentement explicite — cases NON pré-cochées, finalités énoncées, preuve horodatée côté API.
 */
export default function PageActivation() {
  const [parametres] = useSearchParams();
  const jeton = parametres.get('jeton') ?? '';
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [consentementCompte, setConsentementCompte] = useState(false);
  const [consentementSatisfaction, setConsentementSatisfaction] = useState(false);
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
    if (confirmation !== motDePasse || !consentementCompte) return;
    if (!motDePasseConforme(motDePasse)) {
      setErreurChamp('Le mot de passe ne respecte pas tous les critères ci-dessous.');
      return;
    }
    setEnCours(true);
    try {
      await authApi.activer(jeton, motDePasse, consentementCompte, consentementSatisfaction);
      setTermine(true);
    } catch (e) {
      if (e instanceof ErreurApi && e.code === 'MOT_DE_PASSE_NON_CONFORME') {
        setErreurChamp(e.erreursChamps.motDePasse ?? e.message);
      } else {
        setErreur(e instanceof ErreurApi ? e.message : 'Activation impossible pour le moment.');
      }
    } finally {
      setEnCours(false);
    }
  };

  return (
    <CarteAuth titreDocument="Activation du compte" sousTitre="Activation de votre compte">
      {!jeton && (
        <Alerte type="erreur">
          <p>Lien d’activation incomplet. Utilisez le lien reçu par email.</p>
        </Alerte>
      )}
      {erreur && (
        <Alerte type="erreur">
          <p>{erreur}</p>
        </Alerte>
      )}
      {termine ? (
        <Alerte type="succes" titre="Compte activé">
          <p>
            <Link to="/connexion">Se connecter</Link>
          </p>
        </Alerte>
      ) : (
        jeton && (
          <form onSubmit={surEnvoi} noValidate aria-label="Activation du compte">
            <ChampsNouveauMotDePasse
              libelle="Choisissez votre mot de passe"
              valeur={motDePasse}
              confirmation={confirmation}
              surValeur={setMotDePasse}
              surConfirmation={setConfirmation}
              erreurServeur={erreurChamp}
              soumis={soumis}
            />
            <fieldset className="groupe">
              <legend>Utilisation de vos données personnelles</legend>
              <CaseACocher
                checked={consentementCompte}
                onChange={(e) => setConsentementCompte(e.target.checked)}
                required
                aria-invalid={soumis && !consentementCompte ? true : undefined}
                libelle={
                  <>
                    J’accepte que FORMACTIV traite mes données (identité, email, parcours de
                    formation) pour gérer mon compte, mes inscriptions et mes documents.{' '}
                    <strong>(obligatoire)</strong>
                  </>
                }
                indice={
                  <>
                    Détail des finalités et durées de conservation :{' '}
                    <Link to="/confidentialite" target="_blank" rel="noopener">
                      protection des données (nouvelle fenêtre)
                    </Link>
                    .
                  </>
                }
              />
              {soumis && !consentementCompte && (
                <p className="champ__erreur" role="alert">
                  Ce consentement est nécessaire pour utiliser la plateforme.
                </p>
              )}
              <CaseACocher
                checked={consentementSatisfaction}
                onChange={(e) => setConsentementSatisfaction(e.target.checked)}
                libelle="J’accepte de recevoir des questionnaires de satisfaction à l’issue de mes formations (facultatif, retirable à tout moment)."
              />
            </fieldset>
            <Bouton type="submit" bloc chargement={enCours}>
              Activer mon compte
            </Bouton>
          </form>
        )
      )}
    </CarteAuth>
  );
}
