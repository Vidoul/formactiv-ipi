import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  Carte,
  Chargement,
  EnTetePage,
  GraphiqueBarres,
  Indicateur,
  Tableau,
} from '../../components/ui';
import { formaterDateHeure, formaterNombre } from '../../utils/formatage';
import { libelleAction } from '../../utils/libelles';
import { clesTableaux, reportingApi, type TableauAdministration } from './api';
import { libelleVariation, tonalite } from './periodes';

const JOURS = ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'];
const JOURS_LONGS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function libellesJour(iso: string): { court: string; long: string } {
  const jour = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return {
    court: JOURS[jour],
    long: `${JOURS_LONGS[jour]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
  };
}

/** Écran Figma 05 — Tableau de bord d'administration : santé des comptes, sécurité, RGPD (US-27). */
export default function PageTableauAdministration() {
  usePage('Tableau de bord');
  const requete = useQuery({
    queryKey: clesTableaux.administration,
    queryFn: reportingApi.administration,
  });
  return (
    <>
      <EnTetePage
        titre="Tableau de bord d’administration"
        sousTitre="Vue technique et conformité de la plateforme."
      />
      {requete.error && <AlerteErreur erreur={requete.error} />}
      {requete.isPending && <Chargement />}
      {requete.data && <Contenu t={requete.data} />}
    </>
  );
}

function Contenu({ t }: { t: TableauAdministration }) {
  const { enAttente, suppressions } = t.demandesRgpd;
  return (
    <div className="pile">
      <div className="grille grille--indicateurs">
        <Indicateur valeur={formaterNombre(t.comptesActifs)} libelle="Comptes actifs" />
        <Indicateur
          valeur={formaterNombre(t.connexions.total)}
          libelle="Connexions (7 derniers jours)"
          complement={libelleVariation(t.connexions.variation)}
          tonalite={tonalite(t.connexions.variation)}
        />
        <Indicateur
          valeur={formaterNombre(enAttente)}
          libelle="Demandes RGPD en attente"
          complement={
            suppressions > 0
              ? `dont ${suppressions} suppression${suppressions > 1 ? 's' : ''}`
              : undefined
          }
          tonalite={suppressions > 0 ? 'negative' : 'neutre'}
        />
        <Indicateur
          valeur={formaterNombre(t.comptesVerrouilles)}
          libelle="Comptes verrouillés"
          complement={t.comptesVerrouilles > 0 ? 'après échecs de connexion' : undefined}
          tonalite={t.comptesVerrouilles > 0 ? 'negative' : 'neutre'}
        />
      </div>

      <div className="grille grille--2">
        <Carte titre="Connexions par jour (7 jours)">
          <GraphiqueBarres
            titre="Connexions par jour sur les 7 derniers jours"
            serie="Connexions réussies"
            donnees={t.connexions.parJour.map((j) => ({
              libelle: libellesJour(j.jour).court,
              libelleLong: libellesJour(j.jour).long,
              valeur: j.connexions,
            }))}
          />
        </Carte>
        <Carte
          titre="Dernières actions sensibles"
          actions={<Link to="/admin/journal">Ouvrir le journal complet</Link>}
        >
          <Tableau
            legende="Extrait du journal d’audit"
            lignes={t.dernieresActions}
            cleLigne={(a) => a.id}
            vide="Aucune action récente."
            colonnes={[
              { cle: 'quand', entete: 'Quand', rendu: (a) => formaterDateHeure(a.date) },
              {
                cle: 'qui',
                entete: 'Qui',
                rendu: (a) => (a.auteur ? `${a.auteur.prenom} ${a.auteur.nom}` : 'Système'),
              },
              {
                cle: 'action',
                entete: 'Action',
                enteteLigne: true,
                rendu: (a) => (
                  <>
                    {libelleAction(a.action)}
                    {a.details && <span className="texte-discret"> — {a.details}</span>}
                  </>
                ),
              },
            ]}
          />
        </Carte>
      </div>
    </div>
  );
}
