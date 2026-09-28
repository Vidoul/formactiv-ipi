import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { useUtilisateur } from '../../auth/ContexteAuth';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  Badge,
  BadgeStatut,
  Bouton,
  Carte,
  Chargement,
  Dialogue,
  EnTetePage,
  Tableau,
} from '../../components/ui';
import { aujourdhuiIso, formaterPlageDates } from '../../utils/formatage';
import { MODALITES, STATUTS_INSCRIPTION } from '../../utils/libelles';
import { clesSessions, sessionsApi, type Session } from '../sessions/api';

/** Écran Figma 15 — Mes sessions du formateur (UC-07, US-14). */
export default function PageMesSessions() {
  usePage('Mes sessions');
  const moi = useUtilisateur();
  const [inscritsDe, setInscritsDe] = useState<Session | null>(null);
  const sessions = useQuery({
    queryKey: clesSessions.sessions({ limit: 100 }),
    queryFn: () => sessionsApi.lister({ limit: 100 }),
  });

  const toutes = sessions.data?.donnees ?? [];
  const aVenir = toutes
    .filter((s) => s.statutTemporel !== 'TERMINEE')
    .sort((a, b) => a.dateDebut.localeCompare(b.dateDebut));
  const passees = toutes.filter((s) => s.statutTemporel === 'TERMINEE');
  const annee = aujourdhuiIso().slice(0, 4);
  const animeesCetteAnnee = passees.filter((s) => s.dateDebut.startsWith(annee)).length;

  return (
    <>
      <EnTetePage
        titre="Mes sessions"
        sousTitre={`${moi.prenom} ${moi.nom} — ${aVenir.length} session${aVenir.length > 1 ? 's' : ''} à venir, ${animeesCetteAnnee} animée${animeesCetteAnnee > 1 ? 's' : ''} cette année.`}
      />
      {sessions.error && <AlerteErreur erreur={sessions.error} />}
      {sessions.isPending ? (
        <Chargement />
      ) : (
        <div className="pile">
          <Carte titre="À venir" legende="Sessions à venir et en cours">
            <Tableau
              legende="Sessions à venir"
              legendeMasquee
              lignes={aVenir}
              cleLigne={(s) => s.id}
              vide="Aucune session à venir."
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
                  rendu: (s) => (
                    <>
                      {formaterPlageDates(s.dateDebut, s.dateFin)}
                      {s.statutTemporel === 'EN_COURS' && (
                        <>
                          {' '}
                          <Badge variante="info">En cours</Badge>
                        </>
                      )}
                    </>
                  ),
                },
                {
                  cle: 'lieu',
                  entete: 'Lieu / modalité',
                  rendu: (s) =>
                    [s.lieu, MODALITES[s.formation.modalite].toLowerCase()]
                      .filter(Boolean)
                      .join(' - '),
                },
                {
                  cle: 'inscrits',
                  entete: 'Inscrits',
                  nombre: true,
                  rendu: (s) =>
                    s.capaciteMax ? `${s.nombreInscrits} / ${s.capaciteMax}` : s.nombreInscrits,
                },
                {
                  cle: 'action',
                  entete: 'Action',
                  rendu: (s) => (
                    <Bouton variante="secondaire" petit onClick={() => setInscritsDe(s)}>
                      Voir les inscrits
                      <span className="sr-only"> de la session {s.formation.intitule}</span>
                    </Bouton>
                  ),
                },
              ]}
            />
          </Carte>

          <Carte titre="Passées récemment" legende="Sessions passées">
            <Tableau
              legende="Sessions passées"
              legendeMasquee
              lignes={passees}
              cleLigne={(s) => s.id}
              vide="Aucune session passée."
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
                  cle: 'evaluations',
                  entete: 'Évaluations',
                  rendu: (s) =>
                    s.notesManquantes === 0 ? (
                      <Badge variante="succes">Saisies</Badge>
                    ) : (
                      <Badge variante="alerte">
                        {s.notesManquantes} note{s.notesManquantes > 1 ? 's' : ''} manquante
                        {s.notesManquantes > 1 ? 's' : ''}
                      </Badge>
                    ),
                },
                {
                  cle: 'action',
                  entete: 'Action',
                  rendu: (s) => (
                    <Link
                      to={`/formateur/evaluations?session=${s.id}`}
                      className={`bouton bouton--petit ${s.notesManquantes ? 'bouton--primaire' : 'bouton--secondaire'}`}
                    >
                      {s.notesManquantes ? 'Compléter' : 'Consulter'}
                      <span className="sr-only"> les évaluations de {s.formation.intitule}</span>
                    </Link>
                  ),
                },
              ]}
            />
          </Carte>
        </div>
      )}
      {inscritsDe && (
        <DialogueInscrits session={inscritsDe} surFermeture={() => setInscritsDe(null)} />
      )}
    </>
  );
}

function DialogueInscrits({
  session,
  surFermeture,
}: {
  session: Session;
  surFermeture: () => void;
}) {
  const inscriptions = useQuery({
    queryKey: clesSessions.inscriptions({ sessionId: session.id, limit: 100 }),
    queryFn: () => sessionsApi.inscriptions({ sessionId: session.id, limit: 100 }),
  });
  return (
    <Dialogue
      ouvert
      large
      surChangement={(o) => !o && surFermeture()}
      titre={`Inscrits — ${session.formation.intitule}`}
      description={formaterPlageDates(session.dateDebut, session.dateFin)}
      actions={<Bouton onClick={surFermeture}>Fermer</Bouton>}
    >
      {inscriptions.isPending ? (
        <Chargement />
      ) : (
        <Tableau
          legende="Apprenants inscrits"
          lignes={inscriptions.data?.donnees ?? []}
          cleLigne={(i) => i.id}
          vide="Aucun apprenant inscrit."
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
              cle: 'statut',
              entete: 'Statut',
              rendu: (i) => <BadgeStatut statut={i.statut} libelles={STATUTS_INSCRIPTION} />,
            },
          ]}
        />
      )}
    </Dialogue>
  );
}
