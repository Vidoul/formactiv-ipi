import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ErreurApi } from '../api/client';
import { Alerte, Bouton, ChampTexte } from '../components/ui';
import { CarteAuth, Etapes } from './composants';
import { authApi } from './api';

/** Écran Figma 02 (étape 1) — demande de lien de réinitialisation (UC-02, RG-AUTH-04). */
export default function PageMotDePasseOublie() {
  const [email, setEmail] = useState('');
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const surEnvoi = async (evenement: FormEvent) => {
    evenement.preventDefault();
    setErreur(null);
    setEnCours(true);
    try {
      setConfirmation((await authApi.motDePasseOublie(email.trim())).message);
    } catch (e) {
      setErreur(
        e instanceof ErreurApi && e.code === 'VALIDATION'
          ? 'Veuillez saisir une adresse email valide.'
          : e instanceof ErreurApi
            ? e.message
            : 'Envoi impossible pour le moment.',
      );
    } finally {
      setEnCours(false);
    }
  };

  return (
    <CarteAuth titreDocument="Mot de passe oublié" sousTitre="Récupération de mot de passe">
      <Etapes
        courante={confirmation ? 2 : 1}
        libelle={confirmation ? 'email envoyé' : 'adresse du compte'}
      />
      {erreur && (
        <Alerte type="erreur">
          <p>{erreur}</p>
        </Alerte>
      )}
      {confirmation ? (
        <Alerte type="succes">
          <p>{confirmation}</p>
        </Alerte>
      ) : (
        <form onSubmit={surEnvoi} noValidate aria-label="Demande de réinitialisation">
          <ChampTexte
            libelle="Adresse email du compte"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            obligatoire
          />
          <Bouton type="submit" bloc chargement={enCours}>
            Envoyer le lien de réinitialisation
          </Bouton>
          <p className="note">
            Si un compte existe pour cette adresse, un email est envoyé. Le lien est valable 30
            minutes et ne peut être utilisé qu’une fois.
          </p>
        </form>
      )}
      <Link to="/connexion" className="carte-auth__lien">
        Retour à la connexion
      </Link>
    </CarteAuth>
  );
}
