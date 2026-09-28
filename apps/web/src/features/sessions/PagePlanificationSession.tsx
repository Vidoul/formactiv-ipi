import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ErreurApi } from '../../api/client';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  Badge,
  Bouton,
  Carte,
  ChampSelection,
  ChampTexte,
  Chargement,
  Dialogue,
  DialogueConfirmation,
  EnTetePage,
  Tableau,
  useNotifier,
} from '../../components/ui';
import { catalogueApi, clesCatalogue } from '../catalogue/api';
import {
  clesSessions,
  sessionsApi,
  type Conflit,
  type FormateurAffecte,
  type Session,
} from './api';

/** Libellé de disponibilité (maquette 12) : « Disponible » ou « Conflit le 15/09 ». */
function Disponibilite({ conflits }: { conflits: Conflit[] }) {
  if (conflits.length === 0) return <Badge variante="succes">Disponible</Badge>;
  const [, mois, jour] = conflits[0].premierJour.split('-');
  return (
    <Badge variante="alerte">
      Conflit le {jour}/{mois}
      <span className="sr-only"> avec la session {conflits[0].formation}</span>
    </Badge>
  );
}

/** Écran Figma 12 — Planifier une session (UC-05, US-10, US-11). */
export default function PagePlanificationSession() {
  const { id } = useParams();
  const creation = !id;
  const session = useQuery({
    queryKey: clesSessions.session(id ?? 'nouvelle'),
    queryFn: () => sessionsApi.detail(id!),
    enabled: !creation,
  });
  usePage(creation ? 'Planifier une session' : 'Session', [
    { libelle: 'Sessions', chemin: '/sessions' },
  ]);

  if (!creation && session.isPending) return <Chargement />;
  if (!creation && session.error) return <AlerteErreur erreur={session.error} />;
  return <Planification key={id ?? 'nouvelle'} session={session.data ?? null} />;
}

function Planification({ session }: { session: Session | null }) {
  const client = useQueryClient();
  const notifier = useNotifier();
  const navigate = useNavigate();
  const [formationId, setFormationId] = useState(session?.formation.id ?? '');
  const [dateDebut, setDateDebut] = useState(session?.dateDebut ?? '');
  const [dateFin, setDateFin] = useState(session?.dateFin ?? '');
  const [capacite, setCapacite] = useState(session?.capaciteMax ? String(session.capaciteMax) : '');
  const [lieu, setLieu] = useState(session?.lieu ?? '');
  // En création, les formateurs sont choisis avant l'enregistrement de la session.
  const [formateursChoisis, setFormateursChoisis] = useState<string[]>([]);
  const [dialogueAffectation, setDialogueAffectation] = useState(false);
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);

  const formations = useQuery({
    queryKey: clesCatalogue.formations({ statut: 'PUBLIEE', limit: 100 }),
    queryFn: () => catalogueApi.formations({ statut: 'PUBLIEE', limit: 100 }),
  });
  const periodeValide = dateDebut !== '' && dateFin !== '' && dateDebut <= dateFin;
  const disponibilites = useQuery({
    queryKey: clesSessions.disponibilites({ dateDebut, dateFin, session: session?.id }),
    queryFn: () => sessionsApi.disponibilites(dateDebut, dateFin, session?.id),
    enabled: periodeValide,
  });

  const rafraichir = (maj?: Session) => {
    void client.invalidateQueries({ queryKey: ['sessions'] });
    void client.invalidateQueries({ queryKey: ['disponibilites'] });
    if (maj) client.setQueryData(clesSessions.session(maj.id), maj);
  };

  const enregistrer = useMutation({
    mutationFn: () => {
      const saisie = {
        dateDebut,
        dateFin,
        capaciteMax: capacite ? Number(capacite) : null,
        lieu,
      };
      return session
        ? sessionsApi.modifier(session.id, saisie)
        : sessionsApi.creer({ ...saisie, formationId, formateurIds: formateursChoisis });
    },
    onSuccess: (maj) => {
      rafraichir(maj);
      notifier.succes(session ? 'Session enregistrée.' : 'Session planifiée.');
      if (!session) navigate(`/sessions/${maj.id}`, { replace: true });
    },
  });

  const affectation = useMutation({
    mutationFn: ({
      action,
      formateurId,
    }: {
      action: 'affecter' | 'retirer';
      formateurId: string;
    }) =>
      action === 'affecter'
        ? sessionsApi.affecter(session!.id, formateurId)
        : sessionsApi.retirer(session!.id, formateurId),
    onSuccess: (maj) => rafraichir(maj),
    onError: (e) => notifier.erreur(e instanceof ErreurApi ? e.message : 'Action impossible.'),
  });

  const supprimer = useMutation({
    mutationFn: () => sessionsApi.supprimer(session!.id),
    onSuccess: () => {
      rafraichir();
      notifier.succes('Session supprimée.');
      navigate('/sessions');
    },
    onError: (e) => {
      setConfirmationSuppression(false);
      notifier.erreur(e instanceof ErreurApi ? e.message : 'Suppression impossible.');
    },
  });

  const dispoParId = new Map((disponibilites.data ?? []).map((f) => [f.id, f]));
  const affectes: FormateurAffecte[] = session
    ? session.formateurs
    : formateursChoisis.map(
        (fid) => dispoParId.get(fid) ?? { id: fid, nom: '', prenom: 'Formateur', conflits: [] },
      );

  const affecter = (formateurId: string) => {
    if (session) affectation.mutate({ action: 'affecter', formateurId });
    else setFormateursChoisis((l) => [...l, formateurId]);
    setDialogueAffectation(false);
  };
  const retirer = (formateurId: string) => {
    if (session) affectation.mutate({ action: 'retirer', formateurId });
    else setFormateursChoisis((l) => l.filter((x) => x !== formateurId));
  };

  const erreurs = enregistrer.error instanceof ErreurApi ? enregistrer.error.erreursChamps : {};
  const surEnvoi = (e: FormEvent) => {
    e.preventDefault();
    enregistrer.mutate();
  };
  const intitule =
    session?.formation.intitule ??
    formations.data?.donnees.find((f) => f.id === formationId)?.intitule;

  return (
    <>
      <EnTetePage
        titre={session ? 'Session' : 'Planifier une session'}
        sousTitre={intitule ? `Formation : ${intitule}` : 'Choisissez une formation publiée.'}
        actions={
          session && (
            <Link to={`/inscriptions?session=${session.id}`} className="bouton bouton--secondaire">
              Suivre les inscriptions
            </Link>
          )
        }
      />
      <div className="grille grille--2">
        <Carte titre="Paramètres de la session">
          <form onSubmit={surEnvoi} noValidate aria-label="Paramètres de la session">
            {enregistrer.error && Object.keys(erreurs).length === 0 && (
              <AlerteErreur erreur={enregistrer.error} />
            )}
            <ChampSelection
              libelle="Formation"
              value={formationId}
              onChange={(e) => setFormationId(e.target.value)}
              optionVide="Choisir une formation publiée"
              options={(formations.data?.donnees ?? []).map((f) => ({
                valeur: f.id,
                libelle: `${f.intitule} (publiée)`,
              }))}
              erreur={erreurs.formationId}
              disabled={!!session}
              obligatoire
            />
            <div className="formulaire-ligne">
              <ChampTexte
                libelle="Date de début"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                erreur={erreurs.dateDebut}
                obligatoire
              />
              <ChampTexte
                libelle="Date de fin"
                type="date"
                value={dateFin}
                min={dateDebut || undefined}
                onChange={(e) => setDateFin(e.target.value)}
                erreur={erreurs.dateFin}
                obligatoire
              />
            </div>
            <ChampTexte
              libelle="Capacité maximale (optionnel)"
              type="number"
              min={1}
              value={capacite}
              onChange={(e) => setCapacite(e.target.value)}
              indice="L’inscription est refusée au-delà de la capacité (RG-SESS-03)."
              erreur={erreurs.capaciteMax}
            />
            <ChampTexte
              libelle="Lieu (optionnel)"
              value={lieu}
              onChange={(e) => setLieu(e.target.value)}
              placeholder="Toulouse, Distanciel…"
            />
            <div className="rangee">
              <Bouton type="submit" chargement={enregistrer.isPending}>
                {session ? 'Enregistrer' : 'Créer la session'}
              </Bouton>
              {session && session.nombreInscrits === 0 && (
                <Bouton variante="danger" onClick={() => setConfirmationSuppression(true)}>
                  Supprimer la session
                </Bouton>
              )}
            </div>
          </form>
        </Carte>

        <Carte titre="Formateurs affectés (RG-SESS-02)" legende="Formateurs de la session">
          {session?.alerteSansFormateur && (
            <p className="champ__erreur" role="status">
              Aucun formateur alors que la session débute bientôt.
            </p>
          )}
          <Tableau
            legende="Formateurs de la session"
            legendeMasquee
            lignes={affectes}
            cleLigne={(f) => f.id}
            vide="Aucun formateur affecté."
            colonnes={[
              {
                cle: 'nom',
                entete: 'Formateur',
                enteteLigne: true,
                rendu: (f) => `${f.prenom} ${f.nom}`,
              },
              {
                cle: 'dispo',
                entete: 'Disponibilité',
                rendu: (f) => <Disponibilite conflits={f.conflits} />,
              },
              {
                cle: 'action',
                entete: <span className="sr-only">Action</span>,
                rendu: (f) => (
                  <Bouton variante="danger" petit onClick={() => retirer(f.id)}>
                    Retirer<span className="sr-only"> {`${f.prenom} ${f.nom}`}</span>
                  </Bouton>
                ),
              },
            ]}
          />
          <div style={{ marginTop: 'var(--espace-4)' }}>
            <Bouton
              variante="secondaire"
              onClick={() => setDialogueAffectation(true)}
              disabled={!periodeValide}
            >
              Affecter un formateur
            </Bouton>
          </div>
          <p className="note">
            Au moins un formateur doit être affecté avant la date de début.
            {!periodeValide && ' Renseignez les dates pour connaître les disponibilités.'}
          </p>
        </Carte>
      </div>

      {dialogueAffectation && (
        <DialogueAffectation
          disponibles={(disponibilites.data ?? []).filter(
            (f) => !affectes.some((a) => a.id === f.id),
          )}
          chargement={disponibilites.isPending}
          surAffectation={affecter}
          surFermeture={() => setDialogueAffectation(false)}
        />
      )}
      {session && (
        <DialogueConfirmation
          ouvert={confirmationSuppression}
          surChangement={setConfirmationSuppression}
          titre="Supprimer cette session ?"
          message="La session et ses affectations seront supprimées."
          libelleConfirmation="Supprimer"
          surConfirmation={() => supprimer.mutate()}
          chargement={supprimer.isPending}
          danger
        />
      )}
    </>
  );
}

function DialogueAffectation({
  disponibles,
  chargement,
  surAffectation,
  surFermeture,
}: {
  disponibles: FormateurAffecte[];
  chargement: boolean;
  surAffectation: (id: string) => void;
  surFermeture: () => void;
}) {
  const [choix, setChoix] = useState('');
  return (
    <Dialogue
      ouvert
      surChangement={(o) => !o && surFermeture()}
      titre="Affecter un formateur"
      description="Les conflits d’agenda sur la période de la session sont signalés."
      actions={
        <>
          <Bouton variante="secondaire" onClick={surFermeture}>
            Annuler
          </Bouton>
          <Bouton onClick={() => choix && surAffectation(choix)} disabled={!choix}>
            Affecter
          </Bouton>
        </>
      }
    >
      {chargement ? (
        <Chargement />
      ) : (
        <ChampSelection
          libelle="Formateur"
          value={choix}
          onChange={(e) => setChoix(e.target.value)}
          optionVide="Choisir un formateur"
          options={disponibles.map((f) => ({
            valeur: f.id,
            libelle: `${f.prenom} ${f.nom} — ${
              f.conflits.length ? `conflit avec ${f.conflits[0].formation}` : 'disponible'
            }`,
          }))}
        />
      )}
    </Dialogue>
  );
}
