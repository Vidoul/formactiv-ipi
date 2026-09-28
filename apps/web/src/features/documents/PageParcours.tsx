import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { useUtilisateur } from '../../auth/ContexteAuth';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  BadgeStatut,
  Carte,
  Chargement,
  EnTetePage,
  EtatVide,
  Progression,
  Tableau,
} from '../../components/ui';
import { formaterMoisAnnee } from '../../utils/formatage';
import { STATUTS_INSCRIPTION } from '../../utils/libelles';
import { clesDocuments, documentsApi, type EtapeParcours } from './api';

const FORMAT_MOYENNE = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** « 13,5 / 20 (partiel) » : moyenne des notes saisies (maquette 19). */
export function libelleMoyenne(e: Pick<EtapeParcours, 'moyenne' | 'partielle'>): string {
  if (e.moyenne === null) return '—';
  return `${FORMAT_MOYENNE.format(e.moyenne)} / 20${e.partielle ? ' (partiel)' : ''}`;
}

/**
 * Écran Figma 19 — Parcours de formation (UC-10, US-21, RG-HIST-01). Sans paramètre : le parcours
 * de l'apprenant connecté ; avec `:id` : consultation par l'administration.
 */
export default function PageParcours() {
  const moi = useUtilisateur();
  const { id } = useParams();
  const apprenantId = id ?? moi.id;
  const personnel = apprenantId === moi.id;
  usePage(
    personnel ? 'Mon parcours' : 'Parcours',
    personnel ? [] : [{ libelle: 'Documents', chemin: '/documents' }],
  );

  const parcours = useQuery({
    queryKey: clesDocuments.parcours(apprenantId),
    queryFn: () => documentsApi.parcours(apprenantId),
  });
  const p = parcours.data;
  const nom = p ? `${p.apprenant.prenom} ${p.apprenant.nom}` : '';

  return (
    <>
      <EnTetePage
        titre={personnel ? 'Mon parcours de formation' : `Parcours de formation de ${nom}`}
        sousTitre={
          personnel
            ? 'Historique complet de vos formations, notes et compétences.'
            : 'Historique complet des formations, notes et compétences (RG-HIST-01).'
        }
      />
      {parcours.error && <AlerteErreur erreur={parcours.error} />}
      {parcours.isPending && <Chargement />}
      {p &&
        (p.etapes.length === 0 ? (
          <EtatVide titre="Aucune formation pour le moment">
            <p>Les inscriptions, notes et documents apparaîtront ici au fil du parcours.</p>
          </EtatVide>
        ) : (
          <>
            <Carte legende="Historique">
              <Tableau
                legende={`Parcours de formation de ${nom}`}
                lignes={p.etapes}
                cleLigne={(e) => e.inscriptionId}
                colonnes={[
                  {
                    cle: 'formation',
                    entete: 'Formation',
                    enteteLigne: true,
                    rendu: (e) => e.formation.intitule,
                  },
                  {
                    cle: 'session',
                    entete: 'Session',
                    rendu: (e) =>
                      e.session.enCours ? (
                        <span className="texte-discret">en cours</span>
                      ) : (
                        formaterMoisAnnee(e.session.dateDebut)
                      ),
                  },
                  {
                    cle: 'statut',
                    entete: 'Statut',
                    rendu: (e) => <BadgeStatut statut={e.statut} libelles={STATUTS_INSCRIPTION} />,
                  },
                  { cle: 'moyenne', entete: 'Notes (moyenne)', rendu: libelleMoyenne },
                  {
                    cle: 'competences',
                    entete: 'Compétences',
                    rendu: (e) => `${e.competencesAcquises} / ${e.competencesVisees} acquises`,
                  },
                  {
                    cle: 'documents',
                    entete: 'Documents',
                    rendu: (e) =>
                      e.documents.length === 0
                        ? '—'
                        : e.documents.map((d) => d.reference).join(', '),
                  },
                ]}
              />
            </Carte>
            <Carte legende="Détail des compétences">
              {p.competences.length === 0 ? (
                <p>Aucune compétence évaluée pour le moment.</p>
              ) : (
                <ul className="pile" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {p.competences.map((c) => (
                    <li key={c.id}>
                      <Progression
                        libelle={c.libelle}
                        pourcentage={c.progression}
                        couleur={c.acquise ? 'vert' : 'bleu'}
                        texteValeur={`${c.progression} % — ${c.acquise ? 'acquise' : 'en cours'}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <p className="note">
                Une compétence est acquise lorsque la note atteint le seuil de la formation (10/20
                par défaut) ; la barre indique la progression vers ce seuil.
              </p>
            </Carte>
          </>
        ))}
    </>
  );
}
