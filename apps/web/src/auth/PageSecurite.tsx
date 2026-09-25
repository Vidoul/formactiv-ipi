import { useMutation } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { ErreurApi } from '../api/client';
import { usePage } from '../components/layout/ContextePage';
import {
  Alerte,
  AlerteErreur,
  Badge,
  Bouton,
  Carte,
  ChampTexte,
  EnTetePage,
  useNotifier,
} from '../components/ui';
import { motDePasseConforme } from '../utils/motDePasse';
import { ChampsNouveauMotDePasse } from './composants';
import { useAuth, useUtilisateur } from './ContexteAuth';
import { authApi, type EnrolementMfa } from './api';

/** Sécurité du compte : double authentification (US-04, RG-AUTH-03) et mot de passe. */
export default function PageSecurite() {
  usePage('Sécurité du compte');
  const utilisateur = useUtilisateur();

  return (
    <>
      <EnTetePage
        titre="Sécurité du compte"
        sousTitre="Double authentification et mot de passe de votre compte."
      />
      {utilisateur.mfaEnrolementRequis && (
        <Alerte type="alerte" titre="Double authentification obligatoire">
          <p>
            Votre profil donne accès à des données sensibles : activez la double authentification
            pour accéder à la plateforme.
          </p>
        </Alerte>
      )}
      <div className="grille grille--2">
        <CarteMfa />
        <CarteMotDePasse />
      </div>
    </>
  );
}

function CarteMfa() {
  const utilisateur = useUtilisateur();
  const { mettreAJourUtilisateur } = useAuth();
  const notifier = useNotifier();
  const [enrolement, setEnrolement] = useState<EnrolementMfa | null>(null);
  const [code, setCode] = useState('');

  const demarrer = useMutation({
    mutationFn: authApi.demarrerEnrolementMfa,
    onSuccess: setEnrolement,
  });
  const confirmer = useMutation({
    mutationFn: () => authApi.confirmerEnrolementMfa(code),
    onSuccess: (profil) => {
      mettreAJourUtilisateur(profil);
      setEnrolement(null);
      setCode('');
      notifier.succes('Double authentification activée.');
    },
  });

  const surConfirmation = (evenement: FormEvent) => {
    evenement.preventDefault();
    confirmer.mutate();
  };
  const erreurCode =
    confirmer.error instanceof ErreurApi
      ? (confirmer.error.erreursChamps.code ?? confirmer.error.message)
      : undefined;

  return (
    <Carte titre="Double authentification (MFA)">
      <p>
        État :{' '}
        {utilisateur.mfaActive ? (
          <Badge variante="succes">Activée</Badge>
        ) : (
          <Badge variante="alerte">Non activée</Badge>
        )}
      </p>
      {utilisateur.mfaActive ? (
        <p className="champ__indice">
          Un code à 6 chiffres de votre application d’authentification est demandé à chaque
          connexion. En cas de perte de votre téléphone, contactez l’administrateur.
        </p>
      ) : !enrolement ? (
        <>
          <p className="champ__indice">
            Installez une application d’authentification (FreeOTP, Google Authenticator, Microsoft
            Authenticator…) puis lancez la configuration.
          </p>
          {demarrer.error && <AlerteErreur erreur={demarrer.error} />}
          <Bouton onClick={() => demarrer.mutate()} chargement={demarrer.isPending}>
            Configurer la double authentification
          </Bouton>
        </>
      ) : (
        <form
          onSubmit={surConfirmation}
          noValidate
          aria-label="Activation de la double authentification"
        >
          <ol className="pile" style={{ paddingLeft: '1.25rem' }}>
            <li>
              Scannez ce QR code avec votre application :
              <br />
              <img
                src={enrolement.qrCode}
                alt="QR code de configuration de la double authentification FORMACTIV"
                width={180}
                height={180}
              />
            </li>
            <li>
              Ou saisissez manuellement la clé :{' '}
              <code className="tableau__mono" style={{ wordBreak: 'break-all' }}>
                {enrolement.secret}
              </code>
            </li>
            <li>Saisissez le code affiché pour confirmer.</li>
          </ol>
          <ChampTexte
            libelle="Code de vérification"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            erreur={erreurCode}
            obligatoire
          />
          <Bouton type="submit" chargement={confirmer.isPending}>
            Activer
          </Bouton>
        </form>
      )}
    </Carte>
  );
}

function CarteMotDePasse() {
  const { deconnecter } = useAuth();
  const navigate = useNavigate();
  const [actuel, setActuel] = useState('');
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [soumis, setSoumis] = useState(false);

  const changer = useMutation({
    mutationFn: () => authApi.changerMotDePasse(actuel, nouveau),
    onSuccess: async () => {
      // Toutes les sessions sont fermées côté API : reconnexion avec le nouveau mot de passe.
      await deconnecter('mot-de-passe-modifie');
      navigate('/connexion', { replace: true });
    },
  });

  const surEnvoi = (evenement: FormEvent) => {
    evenement.preventDefault();
    setSoumis(true);
    if (nouveau !== confirmation || !motDePasseConforme(nouveau)) return;
    changer.mutate();
  };

  const erreurs = changer.error instanceof ErreurApi ? changer.error.erreursChamps : {};
  const erreurGenerale =
    changer.error && !erreurs.motDePasseActuel && !erreurs.motDePasse ? changer.error : null;

  return (
    <Carte titre="Mot de passe">
      <form onSubmit={surEnvoi} noValidate aria-label="Changement de mot de passe">
        {erreurGenerale && <AlerteErreur erreur={erreurGenerale} />}
        <ChampTexte
          libelle="Mot de passe actuel"
          type="password"
          autoComplete="current-password"
          value={actuel}
          onChange={(e) => setActuel(e.target.value)}
          erreur={erreurs.motDePasseActuel}
          obligatoire
        />
        <ChampsNouveauMotDePasse
          valeur={nouveau}
          confirmation={confirmation}
          surValeur={setNouveau}
          surConfirmation={setConfirmation}
          erreurServeur={
            erreurs.motDePasse ??
            (soumis && !motDePasseConforme(nouveau)
              ? 'Le mot de passe ne respecte pas tous les critères.'
              : undefined)
          }
          soumis={soumis}
        />
        <p className="note">Vous serez déconnecté de toutes vos sessions après le changement.</p>
        <Bouton type="submit" chargement={changer.isPending}>
          Modifier le mot de passe
        </Bouton>
      </form>
    </Carte>
  );
}
