import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  BadgeStatut,
  Bouton,
  Carte,
  Chargement,
  EnTetePage,
  Tableau,
} from '../../components/ui';
import { MODALITES, STATUTS_FORMATION } from '../../utils/libelles';
import { catalogueApi, clesCatalogue } from './api';
import { FicheFormation } from './FicheFormation';

/** Écran Figma 10 — Catalogue et fiche formation (UC-04, US-06/07/09). */
export default function PageFormations() {
  usePage('Formations');
  const [parametres, setParametres] = useSearchParams();
  const ouverte = parametres.get('formation');
  const creation = parametres.get('creation') === '1';

  const liste = useQuery({
    queryKey: clesCatalogue.formations({ limit: 100 }),
    queryFn: () => catalogueApi.formations({ limit: 100 }),
  });

  const ouvrir = (id: string | null, nouvelle = false) => {
    const suivant = new URLSearchParams();
    if (id) suivant.set('formation', id);
    if (nouvelle) suivant.set('creation', '1');
    setParametres(suivant);
  };

  const titreFiche = creation
    ? 'Nouvelle formation'
    : ouverte
      ? `Fiche — ${liste.data?.donnees.find((f) => f.id === ouverte)?.intitule ?? 'formation'}`
      : 'Fiche formation';

  return (
    <>
      <EnTetePage
        titre="Formations"
        sousTitre="Catalogue — seules les formations publiées sont visibles des apprenants et clients."
      />
      <div className="grille grille--2-1">
        <Carte titre="Catalogue">
          {liste.error && <AlerteErreur erreur={liste.error} />}
          {liste.isPending ? (
            <Chargement />
          ) : (
            <Tableau
              legende="Catalogue des formations"
              lignes={liste.data?.donnees ?? []}
              cleLigne={(f) => f.id}
              vide="Aucune formation : créez la première formation du catalogue."
              colonnes={[
                {
                  cle: 'intitule',
                  entete: 'Intitulé',
                  enteteLigne: true,
                  rendu: (f) => f.intitule,
                },
                { cle: 'duree', entete: 'Durée', nombre: true, rendu: (f) => `${f.dureeHeures} h` },
                { cle: 'modalite', entete: 'Modalité', rendu: (f) => MODALITES[f.modalite] },
                {
                  cle: 'statut',
                  entete: 'Statut',
                  rendu: (f) => <BadgeStatut statut={f.statut} libelles={STATUTS_FORMATION} />,
                },
                {
                  cle: 'action',
                  entete: <span className="sr-only">Action</span>,
                  rendu: (f) => (
                    <Bouton
                      variante="secondaire"
                      petit
                      onClick={() => ouvrir(f.id)}
                      aria-pressed={ouverte === f.id}
                    >
                      Ouvrir<span className="sr-only"> la fiche {f.intitule}</span>
                    </Bouton>
                  ),
                },
              ]}
            />
          )}
          <div style={{ marginTop: 'var(--espace-4)' }}>
            <Bouton onClick={() => ouvrir(null, true)}>Créer une formation</Bouton>
          </div>
        </Carte>
        <Carte titre={titreFiche}>
          {creation || ouverte ? (
            <FicheFormation
              id={creation ? null : ouverte}
              surCreation={(id) => ouvrir(id)}
              surFermeture={() => ouvrir(null)}
            />
          ) : (
            <p className="champ__indice">Sélectionnez une formation pour la paramétrer.</p>
          )}
        </Carte>
      </div>
    </>
  );
}
