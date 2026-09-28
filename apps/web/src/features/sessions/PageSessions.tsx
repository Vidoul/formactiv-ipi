import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  Badge,
  Carte,
  ChampSelection,
  Chargement,
  EnTetePage,
  Pagination,
  Tableau,
} from '../../components/ui';
import { formaterPlageDates } from '../../utils/formatage';
import { MODALITES } from '../../utils/libelles';
import { clesSessions, LIBELLES_TEMPOREL, sessionsApi, type Session } from './api';

const PERIODES = [
  { valeur: 'a_venir', libelle: 'À venir' },
  { valeur: 'en_cours', libelle: 'En cours' },
  { valeur: 'passees', libelle: 'Passées' },
];

function Formateurs({ session }: { session: Session }) {
  if (session.formateurs.length === 0) {
    return (
      <Badge variante={session.alerteSansFormateur ? 'danger' : 'alerte'}>
        {session.alerteSansFormateur ? 'Aucun formateur — début proche' : 'Aucun formateur'}
      </Badge>
    );
  }
  return <>{session.formateurs.map((f) => `${f.prenom} ${f.nom}`).join(', ')}</>;
}

/** Liste des sessions planifiées (US-10) — accès à la planification (écran Figma 12). */
export default function PageSessions() {
  usePage('Sessions');
  const [periode, setPeriode] = useState('a_venir');
  const [page, setPage] = useState(1);
  const requete = { periode, page, limit: 20 };
  const liste = useQuery({
    queryKey: clesSessions.sessions(requete),
    queryFn: () => sessionsApi.lister(requete),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <EnTetePage
        titre="Sessions"
        sousTitre="Planification des sessions, affectation des formateurs et suivi du remplissage."
        actions={
          <Link to="/sessions/nouvelle" className="bouton bouton--primaire">
            Planifier une session
          </Link>
        }
      />
      <div className="filtres">
        <ChampSelection
          libelle="Période"
          value={periode}
          onChange={(e) => {
            setPage(1);
            setPeriode(e.target.value);
          }}
          optionVide="Toutes"
          options={PERIODES}
        />
      </div>
      <Carte titre="Sessions planifiées">
        {liste.error && <AlerteErreur erreur={liste.error} />}
        {liste.isPending ? (
          <Chargement />
        ) : (
          <>
            <Tableau
              legende="Sessions planifiées"
              legendeMasquee
              lignes={liste.data?.donnees ?? []}
              cleLigne={(s) => s.id}
              vide="Aucune session pour cette période."
              colonnes={[
                {
                  cle: 'formation',
                  entete: 'Formation',
                  enteteLigne: true,
                  rendu: (s) => s.formation.intitule,
                },
                {
                  cle: 'dates',
                  entete: 'Dates',
                  rendu: (s) => formaterPlageDates(s.dateDebut, s.dateFin),
                },
                {
                  cle: 'lieu',
                  entete: 'Lieu / modalité',
                  rendu: (s) => s.lieu ?? MODALITES[s.formation.modalite],
                },
                {
                  cle: 'inscrits',
                  entete: 'Inscrits',
                  nombre: true,
                  rendu: (s) =>
                    s.capaciteMax ? `${s.nombreInscrits} / ${s.capaciteMax}` : s.nombreInscrits,
                },
                {
                  cle: 'formateurs',
                  entete: 'Formateurs',
                  rendu: (s) => <Formateurs session={s} />,
                },
                {
                  cle: 'statut',
                  entete: 'Statut',
                  rendu: (s) => (
                    <Badge variante={s.statutTemporel === 'TERMINEE' ? 'neutre' : 'info'}>
                      {LIBELLES_TEMPOREL[s.statutTemporel]}
                    </Badge>
                  ),
                },
                {
                  cle: 'action',
                  entete: <span className="sr-only">Action</span>,
                  rendu: (s) => (
                    <Link
                      to={`/sessions/${s.id}`}
                      className="bouton bouton--secondaire bouton--petit"
                    >
                      Ouvrir<span className="sr-only"> la session {s.formation.intitule}</span>
                    </Link>
                  ),
                },
              ]}
            />
            {liste.data && (
              <Pagination
                page={page}
                limit={liste.data.limit}
                total={liste.data.total}
                surChangement={setPage}
                elements="sessions"
              />
            )}
          </>
        )}
      </Carte>
    </>
  );
}
