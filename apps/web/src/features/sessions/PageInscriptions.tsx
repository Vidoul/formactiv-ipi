import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { ErreurApi } from '../../api/client';
import { cles, entreprisesApi, utilisateursApi } from '../../api/ressources';
import type { StatutInscription } from '../../api/types';
import { usePage } from '../../components/layout/ContextePage';
import {
  Alerte,
  AlerteErreur,
  Badge,
  BadgeStatut,
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
import { formaterDate, formaterMoisAnnee, formaterPlageDates } from '../../utils/formatage';
import { STATUTS_INSCRIPTION } from '../../utils/libelles';
import { clesSessions, sessionsApi, type Inscription } from './api';

/** Écran Figma 13 — Suivi des inscriptions (UC-06, US-12, US-13, RG-INSC-01..03). */
export default function PageInscriptions() {
  usePage('Inscriptions');
  const client = useQueryClient();
  const notifier = useNotifier();
  const [parametres, setParametres] = useSearchParams();
  const sessionId = parametres.get('session') ?? '';
  const [saisie, setSaisie] = useState({ statut: '', entrepriseId: '' });
  const [filtres, setFiltres] = useState(saisie);
  const [dialogueInscription, setDialogueInscription] = useState(false);
  const [aValider, setAValider] = useState<Inscription | null>(null);

  const sessions = useQuery({
    queryKey: clesSessions.sessions({ limit: 100 }),
    queryFn: () => sessionsApi.lister({ limit: 100 }),
  });
  const entreprises = useQuery({
    queryKey: cles.entreprises({ limit: 100 }),
    queryFn: entreprisesApi.toutes,
  });

  // Sans session choisie : la prochaine session à venir (ou la plus récente).
  useEffect(() => {
    if (sessionId || !sessions.data?.donnees.length) return;
    const liste = sessions.data.donnees;
    const prochaine = [...liste].reverse().find((s) => s.statutTemporel !== 'TERMINEE') ?? liste[0];
    setParametres({ session: prochaine.id }, { replace: true });
  }, [sessionId, sessions.data, setParametres]);

  const session = sessions.data?.donnees.find((s) => s.id === sessionId);
  const requete = { sessionId, ...filtres, limit: 100 };
  const inscriptions = useQuery({
    queryKey: clesSessions.inscriptions(requete),
    queryFn: () => sessionsApi.inscriptions(requete),
    enabled: sessionId !== '',
  });

  const invalider = () => {
    void client.invalidateQueries({ queryKey: ['inscriptions'] });
    void client.invalidateQueries({ queryKey: ['sessions'] });
  };
  const changer = useMutation({
    mutationFn: (p: { id: string; statut: StatutInscription; prerequisVerifies?: boolean }) =>
      sessionsApi.modifierInscription(p.id, {
        statut: p.statut,
        prerequisVerifies: p.prerequisVerifies,
      }),
    onSuccess: (i) => {
      invalider();
      setAValider(null);
      notifier.succes(
        `Inscription de ${i.apprenant.prenom} ${i.apprenant.nom} : ${STATUTS_INSCRIPTION[i.statut].libelle.toLowerCase()}.`,
      );
    },
    onError: (e) => {
      setAValider(null);
      notifier.erreur(e instanceof ErreurApi ? e.message : 'Action impossible.');
    },
  });

  const valider = (i: Inscription) => {
    if (i.prerequisRequis && !i.prerequisVerifies) setAValider(i);
    else changer.mutate({ id: i.id, statut: 'VALIDEE' });
  };

  const appliquer = (e: FormEvent) => {
    e.preventDefault();
    setFiltres(saisie);
  };

  const sousTitre = session
    ? `Session : ${session.formation.intitule} - ${formaterPlageDates(session.dateDebut, session.dateFin)} - ${session.nombreInscrits} inscrits${session.capaciteMax ? ` / ${session.capaciteMax} places` : ''}`
    : 'Choisissez une session.';

  return (
    <>
      <EnTetePage titre="Suivi des inscriptions" sousTitre={sousTitre} />
      <form className="filtres" onSubmit={appliquer} aria-label="Filtrer les inscriptions">
        <ChampSelection
          libelle="Session"
          value={sessionId}
          onChange={(e) => setParametres({ session: e.target.value })}
          options={(sessions.data?.donnees ?? []).map((s) => ({
            valeur: s.id,
            libelle: `${s.formation.intitule} ${formaterMoisAnnee(s.dateDebut)}`,
          }))}
        />
        <ChampSelection
          libelle="Statut"
          value={saisie.statut}
          onChange={(e) => setSaisie({ ...saisie, statut: e.target.value })}
          optionVide="Tous"
          options={(Object.keys(STATUTS_INSCRIPTION) as StatutInscription[]).map((s) => ({
            valeur: s,
            libelle: STATUTS_INSCRIPTION[s].libelle,
          }))}
        />
        <ChampSelection
          libelle="Entreprise"
          value={saisie.entrepriseId}
          onChange={(e) => setSaisie({ ...saisie, entrepriseId: e.target.value })}
          optionVide="Toutes"
          options={(entreprises.data?.donnees ?? []).map((e) => ({
            valeur: e.id,
            libelle: e.raisonSociale,
          }))}
        />
        <Bouton type="submit" variante="secondaire">
          Appliquer
        </Bouton>
      </form>

      <Carte legende="Inscriptions de la session">
        {inscriptions.error && <AlerteErreur erreur={inscriptions.error} />}
        {sessionId && inscriptions.isPending ? (
          <Chargement />
        ) : (
          <Tableau
            legende="Inscriptions de la session"
            legendeMasquee
            lignes={inscriptions.data?.donnees ?? []}
            cleLigne={(i) => i.id}
            vide="Aucune inscription pour ces critères."
            colonnes={[
              {
                cle: 'apprenant',
                entete: 'Apprenant',
                enteteLigne: true,
                rendu: (i) => `${i.apprenant.prenom} ${i.apprenant.nom}`,
              },
              {
                cle: 'entreprise',
                entete: 'Entreprise',
                rendu: (i) => i.apprenant.entreprise?.raisonSociale ?? '—',
              },
              {
                cle: 'date',
                entete: 'Date d’inscription',
                rendu: (i) => formaterDate(i.dateInscription),
              },
              {
                cle: 'prerequis',
                entete: 'Prérequis',
                rendu: (i) =>
                  !i.prerequisRequis ? (
                    '—'
                  ) : i.prerequisVerifies ? (
                    <Badge variante="succes">OK</Badge>
                  ) : (
                    <Badge variante="alerte">À vérifier</Badge>
                  ),
              },
              {
                cle: 'statut',
                entete: 'Statut',
                rendu: (i) => <BadgeStatut statut={i.statut} libelles={STATUTS_INSCRIPTION} />,
              },
              {
                cle: 'action',
                entete: 'Action',
                rendu: (i) => (
                  <ActionsInscription
                    inscription={i}
                    surValider={() => valider(i)}
                    surChangement={(statut) => changer.mutate({ id: i.id, statut })}
                  />
                ),
              },
            ]}
          />
        )}
        <div style={{ marginTop: 'var(--espace-4)' }}>
          <Bouton onClick={() => setDialogueInscription(true)} disabled={!session}>
            Inscrire un apprenant
          </Bouton>
        </div>
        <p className="note">
          Un apprenant ne peut être inscrit qu’une fois à une même session (RG-INSC-01). Prérequis
          non tracés : avertissement à la validation (RG-INSC-03).
        </p>
      </Carte>

      {dialogueInscription && session && (
        <DialogueInscription
          sessionId={session.id}
          surFermeture={() => setDialogueInscription(false)}
          surInscription={invalider}
        />
      )}
      <DialogueConfirmation
        ouvert={aValider !== null}
        surChangement={(o) => !o && setAValider(null)}
        titre="Prérequis à vérifier"
        message={
          aValider
            ? `Les prérequis de la formation ne sont pas tracés comme acquis pour ${aValider.apprenant.prenom} ${aValider.apprenant.nom}. Confirmez-vous les avoir vérifiés (RG-INSC-03) ?`
            : ''
        }
        libelleConfirmation="Prérequis vérifiés — valider"
        surConfirmation={() =>
          aValider &&
          changer.mutate({ id: aValider.id, statut: 'VALIDEE', prerequisVerifies: true })
        }
        chargement={changer.isPending}
      />
    </>
  );
}

function ActionsInscription({
  inscription,
  surValider,
  surChangement,
}: {
  inscription: Inscription;
  surValider: () => void;
  surChangement: (statut: StatutInscription) => void;
}) {
  const nom = `${inscription.apprenant.prenom} ${inscription.apprenant.nom}`;
  const suffixe = <span className="sr-only"> l’inscription de {nom}</span>;
  return (
    <span className="rangee">
      {inscription.statut === 'EN_ATTENTE' && (
        <Bouton petit onClick={surValider}>
          Valider{suffixe}
        </Bouton>
      )}
      {inscription.statut === 'VALIDEE' && (
        <Bouton variante="secondaire" petit onClick={() => surChangement('TERMINEE')}>
          Terminer{suffixe}
        </Bouton>
      )}
      {(inscription.statut === 'EN_ATTENTE' || inscription.statut === 'VALIDEE') && (
        <Bouton variante="lien" petit onClick={() => surChangement('ANNULEE')}>
          Annuler{suffixe}
        </Bouton>
      )}
    </span>
  );
}

function DialogueInscription({
  sessionId,
  surFermeture,
  surInscription,
}: {
  sessionId: string;
  surFermeture: () => void;
  surInscription: () => void;
}) {
  const notifier = useNotifier();
  const [recherche, setRecherche] = useState('');
  const [apprenantId, setApprenantId] = useState('');
  const [avertissement, setAvertissement] = useState(false);
  const apprenants = useQuery({
    queryKey: cles.utilisateurs({ role: 'APPRENANT', recherche, limit: 50 }),
    queryFn: () => utilisateursApi.lister({ role: 'APPRENANT', recherche, limit: 50 }),
  });
  const inscrire = useMutation({
    mutationFn: () => sessionsApi.inscrire(sessionId, apprenantId),
    onSuccess: ({ inscription, avertissements }) => {
      surInscription();
      notifier.succes(
        `${inscription.apprenant.prenom} ${inscription.apprenant.nom} est inscrit(e).`,
      );
      if (avertissements.includes('PREREQUIS_A_VERIFIER')) setAvertissement(true);
      else surFermeture();
    },
  });

  return (
    <Dialogue
      ouvert
      surChangement={(o) => !o && surFermeture()}
      titre="Inscrire un apprenant"
      description="L’inscription est créée « en attente » puis validée par le responsable."
      actions={
        avertissement ? (
          <Bouton onClick={surFermeture}>Fermer</Bouton>
        ) : (
          <>
            <Bouton variante="secondaire" onClick={surFermeture}>
              Annuler
            </Bouton>
            <Bouton
              onClick={() => inscrire.mutate()}
              disabled={!apprenantId}
              chargement={inscrire.isPending}
            >
              Inscrire
            </Bouton>
          </>
        )
      }
    >
      {avertissement ? (
        <Alerte type="alerte" titre="Prérequis à vérifier">
          <p>
            La formation comporte des prérequis : ils devront être vérifiés avant la validation de
            l’inscription (RG-INSC-03).
          </p>
        </Alerte>
      ) : (
        <>
          {inscrire.error && <AlerteErreur erreur={inscrire.error} />}
          <ChampTexte
            libelle="Rechercher un apprenant"
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Nom, prénom ou email"
          />
          <ChampSelection
            libelle="Apprenant"
            value={apprenantId}
            onChange={(e) => setApprenantId(e.target.value)}
            optionVide={apprenants.isPending ? 'Chargement…' : 'Choisir un apprenant'}
            options={(apprenants.data?.donnees ?? []).map((a) => ({
              valeur: a.id,
              libelle: `${a.prenom} ${a.nom}${a.entreprise ? ` — ${a.entreprise.raisonSociale}` : ''}`,
            }))}
          />
        </>
      )}
    </Dialogue>
  );
}
