import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  Bouton,
  Carte,
  ChampSelection,
  ChampTexte,
  Chargement,
  EnTetePage,
  Pagination,
  Tableau,
} from '../../components/ui';
import { ACTIONS_JOURNAL, libelleAction } from '../../utils/libelles';
import { clesRgpd, rgpdApi, type EntreeJournal } from './api';

const PERIODES = [
  { valeur: '7', libelle: '7 derniers jours' },
  { valeur: '30', libelle: '30 derniers jours' },
  { valeur: '90', libelle: '90 derniers jours' },
  { valeur: '365', libelle: '12 derniers mois' },
];

const ACTIONS = Object.entries(ACTIONS_JOURNAL)
  .map(([valeur, libelle]) => ({ valeur, libelle }))
  .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));

/** « 2026-07-28 07:12:04 » : horodatage UTC du journal (maquette 08). */
export function horodatageUtc(iso: string): string {
  return iso.slice(0, 19).replace('T', ' ');
}

/** « utilisateur 8f21 » : objet concerné, identifiant abrégé. */
function objet(e: EntreeJournal): string {
  if (!e.typeObjet) return '—';
  return e.idObjet ? `${e.typeObjet} ${e.idObjet.slice(0, 8)}` : e.typeObjet;
}

/**
 * Écran Figma 08 — Journal des actions sensibles (UC-15, RG-LOG-01) : qui, quoi, quand, sur quel
 * objet. Consultation réservée à l'administrateur ; aucune donnée sensible dans les détails.
 */
export default function PageJournal() {
  usePage('Journal d’audit');
  const [saisie, setSaisie] = useState({ utilisateur: '', action: '', jours: '30' });
  const [filtres, setFiltres] = useState(saisie);
  const [page, setPage] = useState(1);
  const requete = { ...filtres, page, limit: 50 };
  const journal = useQuery({
    queryKey: clesRgpd.journal(requete),
    queryFn: () => rgpdApi.journal(requete),
  });

  const appliquer = (e: FormEvent) => {
    e.preventDefault();
    setFiltres({ ...saisie, utilisateur: saisie.utilisateur.trim() });
    setPage(1);
  };
  const total = journal.data?.total ?? 0;

  return (
    <>
      <EnTetePage
        titre="Journal des actions sensibles"
        sousTitre="Filtrable par utilisateur, action et période. Aucune donnée sensible ni mot de passe dans les détails."
      />
      <form className="filtres" onSubmit={appliquer} aria-label="Filtrer le journal">
        <ChampTexte
          libelle="Utilisateur"
          indice="Nom, email ou « système »"
          value={saisie.utilisateur}
          onChange={(e) => setSaisie({ ...saisie, utilisateur: e.target.value })}
        />
        <ChampSelection
          libelle="Action"
          value={saisie.action}
          onChange={(e) => setSaisie({ ...saisie, action: e.target.value })}
          optionVide="Toutes"
          options={ACTIONS}
        />
        <ChampSelection
          libelle="Période"
          value={saisie.jours}
          onChange={(e) => setSaisie({ ...saisie, jours: e.target.value })}
          options={PERIODES}
        />
        <Bouton type="submit" variante="secondaire">
          Appliquer
        </Bouton>
      </form>
      {journal.error && <AlerteErreur erreur={journal.error} />}
      {journal.isPending && <Chargement />}
      {journal.data && (
        <Carte>
          <Tableau
            legende={`Journal d’audit (${total} entrée${total > 1 ? 's' : ''} sur la période)`}
            lignes={journal.data.donnees}
            cleLigne={(e) => e.id}
            vide="Aucune entrée pour ces critères."
            colonnes={[
              {
                cle: 'date',
                entete: 'Horodatage (UTC)',
                rendu: (e) => <time dateTime={e.date}>{horodatageUtc(e.date)}</time>,
              },
              {
                cle: 'utilisateur',
                entete: 'Utilisateur',
                rendu: (e) =>
                  e.utilisateur ? (
                    <span title={e.utilisateur.email}>
                      {e.utilisateur.prenom} {e.utilisateur.nom}
                    </span>
                  ) : (
                    <span className="texte-discret">système</span>
                  ),
              },
              {
                cle: 'action',
                entete: 'Action',
                enteteLigne: true,
                rendu: (e) => (
                  <>
                    {libelleAction(e.action)} <code className="texte-discret">{e.action}</code>
                  </>
                ),
              },
              { cle: 'objet', entete: 'Objet', rendu: objet },
              { cle: 'details', entete: 'Détails', rendu: (e) => e.details ?? '—' },
            ]}
          />
          <Pagination
            page={journal.data.page}
            limit={journal.data.limit}
            total={journal.data.total}
            surChangement={setPage}
            elements="entrées"
          />
        </Carte>
      )}
    </>
  );
}
