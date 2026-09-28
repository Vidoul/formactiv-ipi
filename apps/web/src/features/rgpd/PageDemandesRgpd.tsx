import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import type { TypeDemandeRgpd } from '../../api/types';
import { usePage } from '../../components/layout/ContextePage';
import {
  Alerte,
  AlerteErreur,
  BadgeStatut,
  Bouton,
  Carte,
  ChampSelection,
  ChampZoneTexte,
  Chargement,
  Dialogue,
  EnTetePage,
  Pagination,
  Tableau,
  useNotifier,
} from '../../components/ui';
import { formaterDate } from '../../utils/formatage';
import { STATUTS_DEMANDE_RGPD, TYPES_DEMANDE_RGPD } from '../../utils/libelles';
import { clesRgpd, rgpdApi, type DemandeAdministration, type StatutTraitement } from './api';

const FILTRES_STATUT = [
  { valeur: 'OUVERTES', libelle: 'Reçue / en cours' },
  { valeur: '', libelle: 'Tous' },
  { valeur: 'RECUE', libelle: 'Reçue' },
  { valeur: 'EN_COURS', libelle: 'En cours' },
  { valeur: 'TRAITEE', libelle: 'Traitée' },
  { valeur: 'REFUSEE', libelle: 'Refusée' },
];

/** Écran Figma 07 — File des demandes RGPD (UC-14, US-31, RG-CPT-02). */
export default function PageDemandesRgpd() {
  usePage('Demandes RGPD');
  const [saisie, setSaisie] = useState({ type: '', statut: 'OUVERTES' });
  const [filtres, setFiltres] = useState(saisie);
  const [page, setPage] = useState(1);
  const [enTraitement, setEnTraitement] = useState<DemandeAdministration | null>(null);
  const [ouvertures, setOuvertures] = useState(0);
  const requete = { ...filtres, page, limit: 20 };

  const demandes = useQuery({
    queryKey: clesRgpd.demandes(requete),
    queryFn: () => rgpdApi.demandes(requete),
  });
  const enAttente = useQuery({
    queryKey: clesRgpd.demandes({ statut: 'OUVERTES', limit: 1 }),
    queryFn: () => rgpdApi.demandes({ statut: 'OUVERTES', limit: 1 }),
  });

  const appliquer = (e: FormEvent) => {
    e.preventDefault();
    setFiltres(saisie);
    setPage(1);
  };
  const ouvrir = (d: DemandeAdministration) => {
    setOuvertures((n) => n + 1);
    setEnTraitement(d);
  };
  const n = enAttente.data?.total;

  return (
    <>
      <EnTetePage
        titre="Demandes RGPD"
        sousTitre={
          n !== undefined &&
          `${n} demande${n > 1 ? 's' : ''} en attente - le traitement est tracé dans le journal d’audit.`
        }
      />
      <form className="filtres" onSubmit={appliquer} aria-label="Filtrer les demandes">
        <ChampSelection
          libelle="Type"
          value={saisie.type}
          onChange={(e) => setSaisie({ ...saisie, type: e.target.value })}
          optionVide="Tous"
          options={(Object.keys(TYPES_DEMANDE_RGPD) as TypeDemandeRgpd[]).map((t) => ({
            valeur: t,
            libelle: TYPES_DEMANDE_RGPD[t],
          }))}
        />
        <ChampSelection
          libelle="Statut"
          value={saisie.statut}
          onChange={(e) => setSaisie({ ...saisie, statut: e.target.value })}
          options={FILTRES_STATUT}
        />
        <Bouton type="submit" variante="secondaire">
          Appliquer
        </Bouton>
      </form>
      {demandes.error && <AlerteErreur erreur={demandes.error} />}
      {demandes.isPending && <Chargement />}
      {demandes.data && (
        <Carte>
          <Tableau
            legende="File de traitement des demandes RGPD"
            lignes={demandes.data.donnees}
            cleLigne={(d) => d.id}
            vide="Aucune demande ne correspond à ces critères."
            colonnes={[
              { cle: 'numero', entete: 'N°', enteteLigne: true, rendu: (d) => d.numero },
              { cle: 'demandeur', entete: 'Demandeur', rendu: (d) => d.demandeur.email },
              { cle: 'type', entete: 'Type', rendu: (d) => TYPES_DEMANDE_RGPD[d.type] },
              { cle: 'recue', entete: 'Reçue le', rendu: (d) => formaterDate(d.dateDemande) },
              {
                cle: 'statut',
                entete: 'Statut',
                rendu: (d) => <BadgeStatut statut={d.statut} libelles={STATUTS_DEMANDE_RGPD} />,
              },
              {
                cle: 'action',
                entete: 'Action',
                rendu: (d) =>
                  d.statut === 'TRAITEE' || d.statut === 'REFUSEE' ? (
                    <span className="texte-discret">
                      Clôturée le {formaterDate(d.dateTraitement).slice(0, 5)}
                    </span>
                  ) : (
                    <Bouton
                      petit
                      variante={d.statut === 'RECUE' ? 'primaire' : 'secondaire'}
                      onClick={() => ouvrir(d)}
                      aria-label={`${d.statut === 'RECUE' ? 'Traiter' : 'Continuer'} la demande ${d.numero}`}
                    >
                      {d.statut === 'RECUE' ? 'Traiter' : 'Continuer'}
                    </Bouton>
                  ),
              },
            ]}
          />
          <Pagination
            page={demandes.data.page}
            limit={demandes.data.limit}
            total={demandes.data.total}
            surChangement={setPage}
            elements="demandes"
          />
          <p className="note">
            Suppression : effacement des données personnelles et anonymisation de l’historique
            statistique (règle RG-CPT-02).
          </p>
        </Carte>
      )}
      <DialogueTraitement
        key={ouvertures}
        demande={enTraitement}
        surFermeture={() => setEnTraitement(null)}
      />
    </>
  );
}

function DialogueTraitement({
  demande,
  surFermeture,
}: {
  demande: DemandeAdministration | null;
  surFermeture: () => void;
}) {
  const client = useQueryClient();
  const notifier = useNotifier();
  const [decision, setDecision] = useState<StatutTraitement>(
    demande?.statut === 'RECUE' ? 'EN_COURS' : 'TRAITEE',
  );
  const [reponse, setReponse] = useState('');
  const [soumis, setSoumis] = useState(false);

  const traiter = useMutation({
    mutationFn: () => rgpdApi.traiter(demande!.id, decision, reponse.trim() || undefined),
    onSuccess: (d) => {
      void client.invalidateQueries({ queryKey: ['demandes-rgpd'] });
      notifier.succes(
        `Demande ${d.numero} : ${STATUTS_DEMANDE_RGPD[d.statut].libelle.toLowerCase()}.`,
      );
      surFermeture();
    },
  });

  const motifManquant = decision === 'REFUSEE' && !reponse.trim();
  const effacement = demande?.type === 'SUPPRESSION' && decision === 'TRAITEE';
  const surEnvoi = (e: FormEvent) => {
    e.preventDefault();
    setSoumis(true);
    if (!motifManquant) traiter.mutate();
  };
  const decisions = [
    ...(demande?.statut === 'RECUE'
      ? [{ valeur: 'EN_COURS', libelle: 'Prendre en charge (en cours)' }]
      : []),
    { valeur: 'TRAITEE', libelle: 'Clôturer : demande traitée' },
    { valeur: 'REFUSEE', libelle: 'Refuser (motif obligatoire)' },
  ];

  return (
    <Dialogue
      ouvert={demande !== null}
      surChangement={(o) => !o && surFermeture()}
      titre={demande ? `Demande ${demande.numero} — ${TYPES_DEMANDE_RGPD[demande.type]}` : ''}
      description={
        demande &&
        `${demande.demandeur.prenom} ${demande.demandeur.nom} (${demande.demandeur.email}), reçue le ${formaterDate(demande.dateDemande)}.`
      }
    >
      {demande && (
        <form onSubmit={surEnvoi} noValidate aria-label="Traitement de la demande">
          {demande.message && (
            <blockquote className="carte" style={{ margin: '0 0 var(--espace-4)' }}>
              {demande.message}
            </blockquote>
          )}
          {traiter.error && <AlerteErreur erreur={traiter.error} />}
          <ChampSelection
            libelle="Décision"
            value={decision}
            onChange={(e) => setDecision(e.target.value as StatutTraitement)}
            options={decisions}
          />
          <ChampZoneTexte
            libelle={
              decision === 'REFUSEE' ? 'Motif du refus' : 'Réponse au demandeur (facultatif)'
            }
            obligatoire={decision === 'REFUSEE'}
            maxLength={1000}
            value={reponse}
            onChange={(e) => setReponse(e.target.value)}
            erreur={soumis && motifManquant ? 'Un refus doit être motivé.' : undefined}
          />
          {effacement && (
            <Alerte type="alerte" titre="Action irréversible">
              <p>
                Le compte sera effacé : données personnelles supprimées, historique anonymisé
                (RG-CPT-02).
              </p>
            </Alerte>
          )}
          <div className="dialogue__actions">
            <Bouton variante="secondaire" onClick={surFermeture}>
              Annuler
            </Bouton>
            <Bouton
              type="submit"
              variante={effacement ? 'danger' : 'primaire'}
              chargement={traiter.isPending}
            >
              {effacement ? 'Effacer le compte et clôturer' : 'Enregistrer la décision'}
            </Bouton>
          </div>
        </form>
      )}
    </Dialogue>
  );
}
