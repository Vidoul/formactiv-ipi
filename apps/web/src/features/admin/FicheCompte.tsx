import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { ErreurApi } from '../../api/client';
import {
  cles,
  entreprisesApi,
  utilisateursApi,
  type SaisieUtilisateur,
  type UtilisateurDetail,
} from '../../api/ressources';
import type { CodeRole } from '../../api/types';
import { useUtilisateur } from '../../auth/ContexteAuth';
import {
  Alerte,
  AlerteErreur,
  Bouton,
  CaseACocher,
  ChampSelection,
  ChampTexte,
  Chargement,
  DialogueConfirmation,
  useNotifier,
} from '../../components/ui';
import { formaterDateHeure } from '../../utils/formatage';
import { ROLES } from '../../utils/libelles';

const ROLES_AVEC_ENTREPRISE: CodeRole[] = ['APPRENANT', 'CLIENT_ENTREPRISE'];

interface FicheCompteProps {
  /** Identifiant du compte affiché, ou null pour la création. */
  id: string | null;
  surFermeture: () => void;
  surCreation: (id: string) => void;
}

/** Fiche compte de l'écran Figma 06 : consultation, modification, suppression / anonymisation. */
export function FicheCompte({ id, surFermeture, surCreation }: FicheCompteProps) {
  const detail = useQuery({
    queryKey: cles.utilisateur(id ?? 'nouveau'),
    queryFn: () => utilisateursApi.detail(id!),
    enabled: id !== null,
  });
  if (id && detail.isPending) return <Chargement />;
  if (id && detail.error) return <AlerteErreur erreur={detail.error} />;
  return (
    <FormulaireCompte
      key={id ?? 'nouveau'}
      compte={id ? (detail.data ?? null) : null}
      surFermeture={surFermeture}
      surCreation={surCreation}
    />
  );
}

function FormulaireCompte({
  compte,
  surFermeture,
  surCreation,
}: {
  compte: UtilisateurDetail | null;
  surFermeture: () => void;
  surCreation: (id: string) => void;
}) {
  const moi = useUtilisateur();
  const client = useQueryClient();
  const notifier = useNotifier();
  const [saisie, setSaisie] = useState({
    nom: compte?.nom ?? '',
    prenom: compte?.prenom ?? '',
    email: compte?.email ?? '',
    role: compte?.role ?? ('APPRENANT' as CodeRole),
    entrepriseId: compte?.entreprise?.id ?? '',
  });
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);
  const entreprises = useQuery({
    queryKey: cles.entreprises({ limit: 100 }),
    queryFn: entreprisesApi.toutes,
  });

  useEffect(() => {
    if (!ROLES_AVEC_ENTREPRISE.includes(saisie.role) && saisie.entrepriseId) {
      setSaisie((s) => ({ ...s, entrepriseId: '' }));
    }
  }, [saisie.role, saisie.entrepriseId]);

  const invalider = () => {
    void client.invalidateQueries({ queryKey: ['utilisateurs'] });
    void client.invalidateQueries({ queryKey: ['utilisateur'] });
  };

  const enregistrer = useMutation({
    mutationFn: (s: SaisieUtilisateur) =>
      compte ? utilisateursApi.modifier(compte.id, s) : utilisateursApi.creer(s),
    onSuccess: (resultat) => {
      invalider();
      if (compte) {
        notifier.succes('Compte enregistré.');
      } else {
        notifier.succes(`Compte créé : un lien d’activation a été envoyé à ${resultat.email}.`);
        surCreation(resultat.id);
      }
    },
  });

  const action = useMutation({
    mutationFn: (s: SaisieUtilisateur) => utilisateursApi.modifier(compte!.id, s),
    onSuccess: () => {
      invalider();
      notifier.succes('Compte mis à jour.');
    },
    onError: (e) => notifier.erreur(e instanceof ErreurApi ? e.message : 'Action impossible.'),
  });

  const renvoyer = useMutation({
    mutationFn: () => utilisateursApi.renvoyerActivation(compte!.id),
    onSuccess: () => notifier.succes('Lien d’activation renvoyé.'),
    onError: (e) => notifier.erreur(e instanceof ErreurApi ? e.message : 'Envoi impossible.'),
  });

  const supprimer = useMutation({
    mutationFn: () => utilisateursApi.supprimer(compte!.id),
    onSuccess: ({ resultat }) => {
      invalider();
      setConfirmationSuppression(false);
      notifier.succes(
        resultat === 'ANONYMISE' ? 'Compte anonymisé (historique conservé).' : 'Compte supprimé.',
      );
      surFermeture();
    },
    onError: (e) => {
      setConfirmationSuppression(false);
      notifier.erreur(e instanceof ErreurApi ? e.message : 'Suppression impossible.');
    },
  });

  const surEnvoi = (evenement: FormEvent) => {
    evenement.preventDefault();
    enregistrer.mutate({
      nom: saisie.nom,
      prenom: saisie.prenom,
      email: saisie.email,
      role: saisie.role,
      entrepriseId: saisie.entrepriseId || null,
    });
  };

  const erreurs = enregistrer.error instanceof ErreurApi ? enregistrer.error.erreursChamps : {};
  const erreurGenerale =
    enregistrer.error && Object.keys(erreurs).length === 0 ? enregistrer.error : null;
  const rolesProposes = (Object.keys(ROLES) as CodeRole[]).filter(
    (r) => moi.role === 'ADMIN' || r !== 'ADMIN',
  );
  const anonymise = compte?.statut === 'ANONYMISE';
  const verrouille = compte?.statut === 'VERROUILLE';

  return (
    <form onSubmit={surEnvoi} noValidate aria-label={compte ? 'Fiche du compte' : 'Nouveau compte'}>
      {erreurGenerale && <AlerteErreur erreur={erreurGenerale} />}
      {compte && !compte.active && !anonymise && (
        <Alerte type="info">
          <p>Compte non activé : le titulaire n’a pas encore choisi son mot de passe.</p>
          <Bouton
            variante="lien"
            petit
            onClick={() => renvoyer.mutate()}
            chargement={renvoyer.isPending}
          >
            Renvoyer le lien d’activation
          </Bouton>
        </Alerte>
      )}
      {verrouille && (
        <Alerte type="alerte">
          <p>
            Compte verrouillé jusqu’à {formaterDateHeure(compte.verrouilleJusquA)} (RG-AUTH-02).
          </p>
          <Bouton variante="lien" petit onClick={() => action.mutate({ statut: 'ACTIF' })}>
            Déverrouiller maintenant
          </Bouton>
        </Alerte>
      )}
      <fieldset className="groupe" disabled={anonymise}>
        <legend className="sr-only">Identité</legend>
        <ChampTexte
          libelle="Nom"
          value={saisie.nom}
          onChange={(e) => setSaisie({ ...saisie, nom: e.target.value })}
          erreur={erreurs.nom}
          autoComplete="off"
          obligatoire
        />
        <ChampTexte
          libelle="Prénom"
          value={saisie.prenom}
          onChange={(e) => setSaisie({ ...saisie, prenom: e.target.value })}
          erreur={erreurs.prenom}
          autoComplete="off"
          obligatoire
        />
        <ChampTexte
          libelle="Email"
          type="email"
          value={saisie.email}
          onChange={(e) => setSaisie({ ...saisie, email: e.target.value })}
          erreur={erreurs.email}
          autoComplete="off"
          obligatoire
        />
        <ChampSelection
          libelle="Rôle (unique)"
          indice="Un compte possède exactement un rôle (RG-CPT-01)."
          value={saisie.role}
          onChange={(e) => setSaisie({ ...saisie, role: e.target.value as CodeRole })}
          options={rolesProposes.map((r) => ({ valeur: r, libelle: ROLES[r] }))}
          disabled={compte?.id === moi.id}
          obligatoire
        />
        {ROLES_AVEC_ENTREPRISE.includes(saisie.role) && (
          <ChampSelection
            libelle="Entreprise"
            value={saisie.entrepriseId}
            onChange={(e) => setSaisie({ ...saisie, entrepriseId: e.target.value })}
            erreur={erreurs.entrepriseId}
            optionVide={
              saisie.role === 'APPRENANT' ? 'Aucune (particulier)' : 'Choisir une entreprise'
            }
            options={(entreprises.data?.donnees ?? []).map((e) => ({
              valeur: e.id,
              libelle: e.raisonSociale,
            }))}
            obligatoire={saisie.role === 'CLIENT_ENTREPRISE'}
          />
        )}
      </fieldset>

      {compte && !anonymise && (
        <CaseACocher
          libelle="MFA activée"
          indice={
            compte.mfaActive
              ? 'Décocher réinitialise la double authentification (perte du téléphone).'
              : 'La double authentification est configurée par le titulaire depuis son espace.'
          }
          checked={compte.mfaActive}
          disabled={!compte.mfaActive}
          onChange={(e) => !e.target.checked && action.mutate({ mfaActive: false })}
        />
      )}

      {compte && (
        <p className="note">
          Créé le {formaterDateHeure(compte.dateCreation)} — dernière connexion :{' '}
          {formaterDateHeure(compte.dateDerniereConnexion)}
        </p>
      )}

      {!anonymise && (
        <div className="rangee" style={{ marginTop: 'var(--espace-4)' }}>
          <Bouton type="submit" chargement={enregistrer.isPending}>
            {compte ? 'Enregistrer' : 'Créer le compte'}
          </Bouton>
          {compte && compte.id !== moi.id && (
            <>
              {compte.statut === 'DESACTIVE' ? (
                <Bouton variante="secondaire" onClick={() => action.mutate({ statut: 'ACTIF' })}>
                  Réactiver
                </Bouton>
              ) : (
                <Bouton
                  variante="secondaire"
                  onClick={() => action.mutate({ statut: 'DESACTIVE' })}
                >
                  Désactiver
                </Bouton>
              )}
              {moi.role === 'ADMIN' && (
                <Bouton variante="danger" onClick={() => setConfirmationSuppression(true)}>
                  Supprimer / anonymiser
                </Bouton>
              )}
            </>
          )}
          {!compte && (
            <Bouton variante="secondaire" onClick={surFermeture}>
              Annuler
            </Bouton>
          )}
        </div>
      )}

      {compte && (
        <DialogueConfirmation
          ouvert={confirmationSuppression}
          surChangement={setConfirmationSuppression}
          titre={`Supprimer le compte de ${compte.prenom} ${compte.nom} ?`}
          message="Les données personnelles seront effacées. Si le compte possède un historique de formation, il sera anonymisé pour conserver les statistiques (RG-CPT-02). Cette action est irréversible."
          libelleConfirmation="Supprimer / anonymiser"
          surConfirmation={() => supprimer.mutate()}
          chargement={supprimer.isPending}
          danger
        />
      )}
    </form>
  );
}
