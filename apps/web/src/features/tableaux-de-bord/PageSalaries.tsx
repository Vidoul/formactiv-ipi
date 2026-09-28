import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useUtilisateur } from '../../auth/ContexteAuth';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  BadgeStatut,
  Bouton,
  Carte,
  ChampSelection,
  Chargement,
  EnTetePage,
  Pagination,
  Tableau,
} from '../../components/ui';
import { formaterMoisAnnee } from '../../utils/formatage';
import type { VarianteBadge } from '../../utils/libelles';
import { catalogueApi, clesCatalogue } from '../catalogue/api';
import { clesTableaux, reportingApi, type EtatSession, type LigneSalarie } from './api';

const ETATS: Record<EtatSession, { libelle: string; variante: VarianteBadge }> = {
  TERMINEE: { libelle: 'Terminée', variante: 'succes' },
  EN_COURS: { libelle: 'En cours', variante: 'info' },
  A_VENIR: { libelle: 'À venir', variante: 'neutre' },
};

/** Avancement synthétique, sans note détaillée (minimisation, maquette 21b). */
export function libelleAvancement(l: LigneSalarie): string {
  if (l.documents.includes('CERTIFICAT')) return 'Certificat obtenu';
  if (l.documents.includes('ATTESTATION')) return 'Attestation disponible';
  if (l.etat === 'A_VENIR') {
    return l.statut === 'EN_ATTENTE' ? 'Inscription en attente' : 'Inscription validée';
  }
  const pourcentage =
    l.competencesVisees === 0 ? 0 : Math.round((l.competencesAcquises / l.competencesVisees) * 100);
  return `${pourcentage} % - ${l.competencesAcquises}/${l.competencesVisees} compétences`;
}

/** Écran Figma 21b — Mes salariés apprenants (US-24, portée entreprise). */
export default function PageSalaries() {
  usePage('Mes salariés');
  const moi = useUtilisateur();
  const [saisie, setSaisie] = useState({ formationId: '', etat: '' });
  const [filtres, setFiltres] = useState(saisie);
  const [page, setPage] = useState(1);
  const requete = { ...filtres, page, limit: 20 };

  const formations = useQuery({
    queryKey: clesCatalogue.formations({ limit: 100 }),
    queryFn: () => catalogueApi.formations({ limit: 100 }),
  });
  const salaries = useQuery({
    queryKey: clesTableaux.salaries(requete),
    queryFn: () => reportingApi.salaries(requete),
  });

  const appliquer = (e: FormEvent) => {
    e.preventDefault();
    setFiltres(saisie);
    setPage(1);
  };
  const raisonSociale = moi.entreprise?.raisonSociale ?? 'votre entreprise';

  return (
    <>
      <EnTetePage
        titre="Mes salariés apprenants"
        sousTitre={
          salaries.data &&
          `${salaries.data.salaries} salarié${salaries.data.salaries > 1 ? 's' : ''} suivi${salaries.data.salaries > 1 ? 's' : ''}.`
        }
      />
      <form className="filtres" onSubmit={appliquer} aria-label="Filtrer les salariés">
        <ChampSelection
          libelle="Formation"
          value={saisie.formationId}
          onChange={(e) => setSaisie({ ...saisie, formationId: e.target.value })}
          optionVide="Toutes"
          options={(formations.data?.donnees ?? []).map((f) => ({
            valeur: f.id,
            libelle: f.intitule,
          }))}
        />
        <ChampSelection
          libelle="Statut"
          value={saisie.etat}
          onChange={(e) => setSaisie({ ...saisie, etat: e.target.value })}
          optionVide="Tous"
          options={(Object.keys(ETATS) as EtatSession[]).map((etat) => ({
            valeur: etat,
            libelle: ETATS[etat].libelle,
          }))}
        />
        <Bouton type="submit" variante="secondaire">
          Appliquer
        </Bouton>
      </form>
      {salaries.error && <AlerteErreur erreur={salaries.error} />}
      {salaries.isPending && <Chargement />}
      {salaries.data && (
        <Carte>
          <Tableau
            legende={`Salariés de ${raisonSociale} en formation`}
            lignes={salaries.data.donnees}
            cleLigne={(l) => l.inscriptionId}
            vide="Aucun salarié ne correspond à ces critères."
            colonnes={[
              {
                cle: 'salarie',
                entete: 'Salarié',
                enteteLigne: true,
                rendu: (l) => `${l.apprenant.prenom} ${l.apprenant.nom}`,
              },
              { cle: 'formation', entete: 'Formation', rendu: (l) => l.formation.intitule },
              {
                cle: 'session',
                entete: 'Session',
                rendu: (l) =>
                  l.etat === 'EN_COURS' ? (
                    <span className="texte-discret">en cours</span>
                  ) : (
                    formaterMoisAnnee(l.session.dateDebut)
                  ),
              },
              { cle: 'avancement', entete: 'Avancement', rendu: libelleAvancement },
              {
                cle: 'statut',
                entete: 'Statut',
                rendu: (l) => <BadgeStatut statut={l.etat} libelles={ETATS} />,
              },
            ]}
          />
          <Pagination
            page={salaries.data.page}
            limit={salaries.data.limit}
            total={salaries.data.total}
            surChangement={setPage}
            elements="inscriptions"
          />
          <p className="note">
            Le détail des notes n’est pas communiqué à l’entreprise : seul l’avancement synthétique
            l’est (point à arbitrer avec FORMACTIV, protection des données des salariés).
          </p>
        </Carte>
      )}
    </>
  );
}
