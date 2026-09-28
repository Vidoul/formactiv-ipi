import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ErreurApi } from '../../api/client';
import { cles, entreprisesApi, type Entreprise } from '../../api/ressources';
import { useUtilisateur } from '../../auth/ContexteAuth';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  Bouton,
  Carte,
  ChampTexte,
  Chargement,
  DialogueConfirmation,
  EnTetePage,
  Tableau,
  useNotifier,
} from '../../components/ui';

/** Gestion des entreprises clientes (REQ-FUNC-018) — complément de l'écran Utilisateurs. */
export default function PageEntreprises() {
  usePage('Entreprises clientes');
  const liste = useQuery({
    queryKey: cles.entreprises({ limit: 100 }),
    queryFn: entreprisesApi.toutes,
  });
  const [selection, setSelection] = useState<Entreprise | 'nouvelle' | null>(null);

  return (
    <>
      <EnTetePage
        titre="Entreprises clientes"
        sousTitre="Entreprises dont les salariés suivent des formations (rattachement des apprenants et comptes client)."
      />
      <div className="grille grille--2-1">
        <Carte titre="Liste des entreprises">
          {liste.error && <AlerteErreur erreur={liste.error} />}
          {liste.isPending ? (
            <Chargement />
          ) : (
            <Tableau
              legende="Entreprises clientes"
              lignes={liste.data?.donnees ?? []}
              cleLigne={(e) => e.id}
              vide="Aucune entreprise enregistrée."
              colonnes={[
                {
                  cle: 'rs',
                  entete: 'Raison sociale',
                  enteteLigne: true,
                  rendu: (e) => e.raisonSociale,
                },
                { cle: 'siret', entete: 'SIRET', rendu: (e) => e.siret ?? '—' },
                { cle: 'contact', entete: 'Contact', rendu: (e) => e.emailContact },
                { cle: 'comptes', entete: 'Comptes', nombre: true, rendu: (e) => e.nombreComptes },
                {
                  cle: 'action',
                  entete: <span className="sr-only">Action</span>,
                  rendu: (e) => (
                    <Bouton variante="secondaire" petit onClick={() => setSelection(e)}>
                      Modifier<span className="sr-only"> {e.raisonSociale}</span>
                    </Bouton>
                  ),
                },
              ]}
            />
          )}
          <div style={{ marginTop: 'var(--espace-4)' }}>
            <Bouton onClick={() => setSelection('nouvelle')}>Ajouter une entreprise</Bouton>
          </div>
        </Carte>
        <Carte titre={selection === 'nouvelle' ? 'Nouvelle entreprise' : 'Fiche entreprise'}>
          {selection ? (
            <FormulaireEntreprise
              key={selection === 'nouvelle' ? 'nouvelle' : selection.id}
              entreprise={selection === 'nouvelle' ? null : selection}
              surFin={() => setSelection(null)}
            />
          ) : (
            <p className="champ__indice">Sélectionnez une entreprise ou ajoutez-en une.</p>
          )}
        </Carte>
      </div>
    </>
  );
}

function FormulaireEntreprise({
  entreprise,
  surFin,
}: {
  entreprise: Entreprise | null;
  surFin: () => void;
}) {
  const moi = useUtilisateur();
  const client = useQueryClient();
  const notifier = useNotifier();
  const [raisonSociale, setRaisonSociale] = useState(entreprise?.raisonSociale ?? '');
  const [siret, setSiret] = useState(entreprise?.siret ?? '');
  const [emailContact, setEmailContact] = useState(entreprise?.emailContact ?? '');
  const [confirmation, setConfirmation] = useState(false);

  const enregistrer = useMutation({
    mutationFn: () => {
      const saisie = { raisonSociale, siret: siret.trim() || null, emailContact };
      return entreprise
        ? entreprisesApi.modifier(entreprise.id, saisie)
        : entreprisesApi.creer(saisie);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['entreprises'] });
      notifier.succes('Entreprise enregistrée.');
      surFin();
    },
  });
  const supprimer = useMutation({
    mutationFn: () => entreprisesApi.supprimer(entreprise!.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['entreprises'] });
      notifier.succes('Entreprise supprimée.');
      surFin();
    },
    onError: (e) => {
      setConfirmation(false);
      notifier.erreur(e instanceof ErreurApi ? e.message : 'Suppression impossible.');
    },
  });

  const erreurs = enregistrer.error instanceof ErreurApi ? enregistrer.error.erreursChamps : {};
  const surEnvoi = (e: FormEvent) => {
    e.preventDefault();
    enregistrer.mutate();
  };

  return (
    <form onSubmit={surEnvoi} noValidate aria-label="Fiche entreprise">
      {enregistrer.error && Object.keys(erreurs).length === 0 && (
        <AlerteErreur erreur={enregistrer.error} />
      )}
      <ChampTexte
        libelle="Raison sociale"
        value={raisonSociale}
        onChange={(e) => setRaisonSociale(e.target.value)}
        erreur={erreurs.raisonSociale}
        obligatoire
      />
      <ChampTexte
        libelle="SIRET (facultatif)"
        inputMode="numeric"
        maxLength={14}
        value={siret}
        onChange={(e) => setSiret(e.target.value.replace(/\D/g, ''))}
        indice="14 chiffres."
        erreur={erreurs.siret}
      />
      <ChampTexte
        libelle="Email de contact"
        type="email"
        value={emailContact}
        onChange={(e) => setEmailContact(e.target.value)}
        erreur={erreurs.emailContact}
        obligatoire
      />
      <div className="rangee">
        <Bouton type="submit" chargement={enregistrer.isPending}>
          Enregistrer
        </Bouton>
        <Bouton variante="secondaire" onClick={surFin}>
          Annuler
        </Bouton>
        {entreprise && moi.role === 'ADMIN' && (
          <Bouton variante="danger" onClick={() => setConfirmation(true)}>
            Supprimer
          </Bouton>
        )}
      </div>
      {entreprise && (
        <DialogueConfirmation
          ouvert={confirmation}
          surChangement={setConfirmation}
          titre={`Supprimer ${entreprise.raisonSociale} ?`}
          message="Seule une entreprise sans compte rattaché peut être supprimée."
          libelleConfirmation="Supprimer"
          surConfirmation={() => supprimer.mutate()}
          chargement={supprimer.isPending}
          danger
        />
      )}
    </form>
  );
}
