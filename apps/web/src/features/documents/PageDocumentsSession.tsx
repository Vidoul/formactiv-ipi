import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import type { TypeDocument } from '../../api/types';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  Badge,
  BadgeStatut,
  Bouton,
  Carte,
  ChampSelection,
  Chargement,
  EnTetePage,
  EtatVide,
  messageErreur,
  Tableau,
  useNotifier,
} from '../../components/ui';
import { formaterDate, formaterPlageDates } from '../../utils/formatage';
import { STATUTS_INSCRIPTION, TYPES_DOCUMENT } from '../../utils/libelles';
import { clesSessions, sessionsApi } from '../sessions/api';
import { clesDocuments, documentsApi, type BilanDocumentsSession, type DemandeExport } from './api';

type Ligne = BilanDocumentsSession['lignes'][number];

const ARTICLE: Record<TypeDocument, string> = {
  CERTIFICAT: 'le certificat',
  ATTESTATION: 'l’attestation',
};

/** Écran Figma 14 — Génération des documents d'une session (UC-09, US-19, US-22). */
export default function PageDocumentsSession() {
  usePage('Documents');
  const [parametres, setParametres] = useSearchParams();
  const sessionId = parametres.get('session') ?? '';

  const sessions = useQuery({
    queryKey: clesSessions.sessions({ limit: 100 }),
    queryFn: () => sessionsApi.lister({ limit: 100 }),
  });
  // Documents générables à l'issue de la session : sessions terminées d'abord, puis en cours.
  const eligibles = (sessions.data?.donnees ?? [])
    .filter((s) => s.statutTemporel !== 'A_VENIR')
    .sort((a, b) => b.dateFin.localeCompare(a.dateFin));

  useEffect(() => {
    if (sessionId || eligibles.length === 0) return;
    const derniere = eligibles.find((s) => s.statutTemporel === 'TERMINEE') ?? eligibles[0];
    setParametres({ session: derniere.id }, { replace: true });
  }, [sessionId, eligibles, setParametres]);

  const bilan = useQuery({
    queryKey: clesDocuments.bilan(sessionId),
    queryFn: () => documentsApi.bilan(sessionId),
    enabled: sessionId !== '',
  });
  const s = bilan.data?.session;

  return (
    <>
      <EnTetePage
        titre="Attestations et certificats"
        sousTitre={
          s &&
          `Session : ${s.formation.intitule} - ${s.terminee ? `terminée le ${formaterDate(s.dateFin)}` : `en cours, fin prévue le ${formaterDate(s.dateFin)}`}`
        }
      />
      {sessions.error && <AlerteErreur erreur={sessions.error} />}
      {sessions.isSuccess && eligibles.length === 0 ? (
        <EtatVide titre="Aucune session commencée">
          <p>Les documents sont générés à l’issue des sessions.</p>
        </EtatVide>
      ) : (
        <div className="filtres">
          <ChampSelection
            libelle="Session"
            value={sessionId}
            onChange={(e) => setParametres({ session: e.target.value })}
            options={eligibles.map((x) => ({
              valeur: x.id,
              libelle: `${x.formation.intitule} — ${formaterPlageDates(x.dateDebut, x.dateFin)}`,
            }))}
          />
        </div>
      )}
      {bilan.error && <AlerteErreur erreur={bilan.error} />}
      {sessionId && bilan.isPending && <Chargement />}
      {bilan.data && <Generation bilan={bilan.data} />}
      {bilan.data && <ExportsSession sessionId={bilan.data.session.id} />}
    </>
  );
}

function Generation({ bilan }: { bilan: BilanDocumentsSession }) {
  const client = useQueryClient();
  const notifier = useNotifier();
  const [enCours, setEnCours] = useState<string | null>(null);

  const generer = useMutation({
    mutationFn: (p: { ligne: Ligne; type: TypeDocument }) =>
      documentsApi.generer(p.ligne.inscriptionId, p.type),
    onMutate: (p) => setEnCours(p.ligne.inscriptionId),
    onSettled: () => setEnCours(null),
    onSuccess: (d) => {
      void client.invalidateQueries({ queryKey: clesDocuments.bilan(bilan.session.id) });
      void client.invalidateQueries({ queryKey: ['documents'] });
      notifier.succes(
        `${TYPES_DOCUMENT[d.type].libelle} ${d.reference} généré pour ${d.apprenant.prenom} ${d.apprenant.nom}.`,
      );
    },
  });

  const action = (l: Ligne) => {
    const type = l.documentPropose;
    if (!type) return <span className="texte-discret">Inscription non terminée</span>;
    const existant = l.documents.find((d) => d.type === type);
    if (existant) {
      return (
        <span>
          {existant.reference} généré le {formaterDate(existant.dateGeneration).slice(0, 5)}{' '}
          <Bouton
            variante="lien"
            petit
            onClick={() =>
              void documentsApi
                .telecharger(existant.id)
                .catch((e: unknown) => notifier.erreur(messageErreur(e)))
            }
            aria-label={`Télécharger ${ARTICLE[existant.type]} ${existant.reference} (PDF)`}
          >
            Télécharger
          </Bouton>
        </span>
      );
    }
    if (!bilan.peutGenerer) return <span className="texte-discret">À générer</span>;
    return (
      <Bouton
        petit
        variante={type === 'CERTIFICAT' ? 'primaire' : 'secondaire'}
        chargement={enCours === l.inscriptionId}
        disabled={enCours !== null && enCours !== l.inscriptionId}
        onClick={() => generer.mutate({ ligne: l, type })}
        aria-label={`Générer ${ARTICLE[type]} de ${l.apprenant.prenom} ${l.apprenant.nom}`}
      >
        Générer {ARTICLE[type]}
      </Bouton>
    );
  };

  return (
    <Carte legende="Génération des documents de la session">
      {generer.error && <AlerteErreur erreur={generer.error} />}
      <Tableau
        legende={`Documents de la session ${bilan.session.formation.intitule}`}
        legendeMasquee
        lignes={bilan.lignes}
        cleLigne={(l) => l.inscriptionId}
        vide="Aucun apprenant validé ou terminé sur cette session."
        colonnes={[
          {
            cle: 'apprenant',
            entete: 'Apprenant',
            enteteLigne: true,
            rendu: (l) => (
              <Link to={`/apprenants/${l.apprenant.id}/parcours`}>
                {l.apprenant.prenom} {l.apprenant.nom}
              </Link>
            ),
          },
          {
            cle: 'completion',
            entete: 'Complétion',
            rendu: (l) => <BadgeStatut statut={l.statut} libelles={STATUTS_INSCRIPTION} />,
          },
          {
            cle: 'competences',
            entete: 'Compétences acquises',
            rendu: (l) => `${l.competencesAcquises} / ${l.competencesVisees}`,
          },
          {
            cle: 'possible',
            entete: 'Document possible',
            rendu: (l) =>
              l.documentPropose ? (
                <BadgeStatut statut={l.documentPropose} libelles={TYPES_DOCUMENT} />
              ) : (
                <Badge variante="neutre">Aucun</Badge>
              ),
          },
          { cle: 'action', entete: 'Action', rendu: action },
        ]}
      />
      <p className="note">
        Chaque document PDF porte une référence unique, la date de génération et l’émetteur
        (RG-CERT-02), et rejoint l’historique du parcours. Sans toutes les compétences acquises,
        seule l’attestation est proposée (RG-CERT-01).
      </p>
    </Carte>
  );
}

function ExportsSession({ sessionId }: { sessionId: string }) {
  const notifier = useNotifier();
  const [enCours, setEnCours] = useState<string | null>(null);

  const exporter = async (cle: string, demande: DemandeExport) => {
    setEnCours(cle);
    try {
      await documentsApi.exporter(demande);
    } catch (erreur) {
      notifier.erreur(messageErreur(erreur));
    } finally {
      setEnCours(null);
    }
  };

  return (
    <Carte legende="Exports">
      <div className="rangee">
        <Bouton
          variante="secondaire"
          chargement={enCours === 'pdf'}
          onClick={() => void exporter('pdf', { jeu: 'resultats', format: 'pdf', sessionId })}
        >
          Exporter la session (PDF)
        </Bouton>
        <Bouton
          variante="secondaire"
          chargement={enCours === 'csv'}
          onClick={() => void exporter('csv', { jeu: 'evaluations', format: 'csv', sessionId })}
        >
          Exporter les résultats (CSV)
        </Bouton>
      </div>
      <p className="note">Les exports respectent la portée du rôle (RG-EXP-01).</p>
    </Carte>
  );
}
