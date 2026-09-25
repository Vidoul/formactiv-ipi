import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ErreurApi } from '../api/client';
import { NAVIGATION } from '../components/layout/navigation';
import { Alerte, Bouton, ChampTexte } from '../components/ui';
import { CarteAuth } from './composants';
import { useAuth } from './ContexteAuth';

const MESSAGES_RAISON = {
  expiree: 'Votre session a expiré. Veuillez vous reconnecter.',
  deconnexion: 'Vous êtes déconnecté.',
  'mot-de-passe-modifie':
    'Mot de passe modifié : reconnectez-vous avec votre nouveau mot de passe.',
} as const;

/**
 * Écran Figma 01 — Connexion (+ MFA). UC-01 : message d'erreur générique, verrouillage après
 * 5 échecs (RG-AUTH-02), code TOTP si la MFA est active (RG-AUTH-03).
 */
export default function PageConnexion() {
  const { etat, connecter, verifierMfa } = useAuth();
  const navigate = useNavigate();
  const emplacement = useLocation();
  const depuis = (emplacement.state as { depuis?: string } | null)?.depuis;

  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [code, setCode] = useState('');
  const [jetonMfa, setJetonMfa] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const champCode = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (etat.statut === 'connecte') {
      navigate(depuis ?? NAVIGATION[etat.utilisateur.role].accueil, { replace: true });
    }
  }, [etat, depuis, navigate]);

  useEffect(() => {
    if (jetonMfa) champCode.current?.focus();
  }, [jetonMfa]);

  const traiterErreur = (e: unknown) => {
    if (e instanceof ErreurApi && e.status === 400 && e.code === 'VALIDATION') {
      setErreur('Veuillez saisir une adresse email et un mot de passe valides.');
    } else {
      setErreur(e instanceof ErreurApi ? e.message : 'Connexion impossible pour le moment.');
    }
  };

  const surConnexion = async (evenement: FormEvent) => {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      const resultat = await connecter(email, motDePasse);
      if (resultat.mfaRequis) setJetonMfa(resultat.jetonMfa);
    } catch (e) {
      traiterErreur(e);
    } finally {
      setEnCours(false);
    }
  };

  const surVerification = async (evenement: FormEvent) => {
    evenement.preventDefault();
    if (!jetonMfa) return;
    setErreur(null);
    setEnCours(true);
    try {
      await verifierMfa(jetonMfa, code.trim());
    } catch (e) {
      if (e instanceof ErreurApi && e.code === 'JETON_MFA_INVALIDE') {
        setJetonMfa(null);
        setCode('');
      }
      traiterErreur(e);
    } finally {
      setEnCours(false);
    }
  };

  const raison = etat.statut === 'anonyme' ? etat.raison : undefined;

  return (
    <CarteAuth
      titreDocument="Connexion"
      sousTitre="Plateforme de gestion des formations et des compétences"
    >
      {raison && !erreur && (
        <Alerte type={raison === 'expiree' ? 'alerte' : 'info'}>
          <p>{MESSAGES_RAISON[raison]}</p>
        </Alerte>
      )}
      {erreur && (
        <Alerte type="erreur">
          <p>{erreur}</p>
        </Alerte>
      )}

      {!jetonMfa ? (
        <form onSubmit={surConnexion} noValidate aria-label="Connexion">
          <ChampTexte
            libelle="Adresse email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            obligatoire
          />
          <ChampTexte
            libelle="Mot de passe"
            type="password"
            autoComplete="current-password"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
            indice="12 caractères minimum, majuscules, minuscules, chiffres et caractères spéciaux."
            obligatoire
          />
          <Bouton type="submit" bloc chargement={enCours}>
            Se connecter
          </Bouton>
          <Link to="/mot-de-passe-oublie" className="carte-auth__lien">
            Mot de passe oublié ?
          </Link>
        </form>
      ) : (
        <form onSubmit={surVerification} noValidate aria-label="Vérification en deux étapes">
          <p role="status" className="champ__indice">
            Double authentification activée pour <strong>{email}</strong>.
          </p>
          <hr className="carte-auth__separateur" />
          <ChampTexte
            ref={champCode}
            libelle="Code de vérification (MFA activée)"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            placeholder="123 456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            indice="Saisissez le code à 6 chiffres de votre application d’authentification."
            obligatoire
          />
          <Bouton type="submit" variante="secondaire" bloc chargement={enCours}>
            Vérifier le code
          </Bouton>
          <Bouton
            variante="lien"
            bloc
            onClick={() => {
              setJetonMfa(null);
              setCode('');
            }}
          >
            Revenir à la saisie de l’email
          </Bouton>
        </form>
      )}
    </CarteAuth>
  );
}
