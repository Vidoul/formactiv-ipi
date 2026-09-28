import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useUtilisateur } from '../../auth/ContexteAuth';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  Carte,
  Chargement,
  EnTetePage,
  GraphiqueBarres,
  Indicateur,
  Progression,
  Tableau,
} from '../../components/ui';
import { formaterNombre, formaterPourcentage, formaterSatisfaction } from '../../utils/formatage';
import { clesTableaux, reportingApi, type Indicateurs } from './api';
import { FiltresTableau, versFiltres, type SelectionFiltres } from './FiltresTableau';
import { jourParis, libelleEcartPoints, libelleMois, libelleVariation, tonalite } from './periodes';

/**
 * Écran Figma 09 — Pilotage des formations (UC-12, US-23, RG-DASH-01..03) : indicateurs globaux
 * filtrables, comparaison avec la période précédente, graphiques doublés d'un tableau équivalent.
 */
export default function PagePilotage() {
  usePage('Tableau de bord');
  const moi = useUtilisateur();
  const jour = jourParis();
  const [selection, setSelection] = useState<SelectionFiltres>({
    periode: 'trimestre',
    formationId: '',
    entrepriseId: '',
  });
  const filtres = versFiltres(selection, jour);
  const requete = useQuery({
    queryKey: clesTableaux.indicateurs(filtres),
    queryFn: () => reportingApi.indicateurs(filtres),
  });

  return (
    <>
      <EnTetePage titre="Pilotage des formations" sousTitre="Vue globale de l’activité." />
      <FiltresTableau
        initial={selection}
        avecEntreprise={moi.role === 'ADMIN' || moi.role === 'RESP_FORMATION'}
        onAppliquer={setSelection}
      />
      {requete.error && <AlerteErreur erreur={requete.error} />}
      {requete.isPending && <Chargement />}
      {requete.data && <Contenu donnees={requete.data} />}
    </>
  );
}

function Contenu({ donnees }: { donnees: Indicateurs }) {
  const { indicateurs: i, comparaison: c } = donnees;
  return (
    <div className="pile">
      <div className="grille grille--indicateurs">
        <Indicateur
          valeur={formaterPourcentage(i.tauxReussite)}
          libelle="Taux de réussite"
          complement={libelleEcartPoints(c.tauxReussitePoints)}
          tonalite={tonalite(c.tauxReussitePoints)}
        />
        <Indicateur
          valeur={formaterPourcentage(i.tauxCompletion)}
          libelle="Taux de complétion"
          complement={libelleEcartPoints(c.tauxCompletionPoints)}
          tonalite={tonalite(c.tauxCompletionPoints)}
        />
        <Indicateur
          valeur={formaterSatisfaction(i.satisfaction.moyenne)}
          libelle="Satisfaction moyenne"
          complement={`${formaterNombre(i.satisfaction.reponses)} réponse${i.satisfaction.reponses > 1 ? 's' : ''}`}
        />
        <Indicateur
          valeur={formaterNombre(i.inscriptions)}
          libelle="Inscriptions sur la période"
          complement={libelleVariation(c.inscriptionsPourcent)}
          tonalite={tonalite(c.inscriptionsPourcent)}
        />
      </div>

      <div className="grille grille--2">
        <Carte titre="Inscriptions par mois">
          <GraphiqueBarres
            titre="Inscriptions par mois"
            serie="Inscriptions validées"
            donnees={donnees.parMois.map((m) => ({
              libelle: libelleMois(m.mois).court,
              libelleLong: libelleMois(m.mois).long,
              valeur: m.inscriptions,
            }))}
          />
        </Carte>
        <Carte titre="Taux de réussite par formation">
          {donnees.parFormation.length === 0 ? (
            <p>Aucune inscription sur la période.</p>
          ) : (
            <ul className="pile" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {donnees.parFormation.map((f) => (
                <li key={f.formation.id}>
                  <Progression
                    libelle={f.formation.intitule}
                    pourcentage={(f.tauxReussite ?? 0) * 100}
                    texteValeur={
                      f.tauxReussite === null
                        ? 'non calculable'
                        : formaterPourcentage(f.tauxReussite)
                    }
                    couleur="vert"
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="note">Certificats obtenus / inscriptions terminées (RG-DASH-01).</p>
        </Carte>
      </div>

      <Carte titre="Équivalent tableau (accessibilité)">
        <Tableau
          legende="Indicateurs par formation"
          lignes={donnees.parFormation}
          cleLigne={(f) => f.formation.id}
          vide="Aucune inscription sur la période."
          colonnes={[
            {
              cle: 'formation',
              entete: 'Formation',
              enteteLigne: true,
              rendu: (f) => f.formation.intitule,
            },
            {
              cle: 'inscriptions',
              entete: 'Inscriptions',
              nombre: true,
              rendu: (f) => formaterNombre(f.inscriptions),
            },
            {
              cle: 'completion',
              entete: 'Complétion',
              nombre: true,
              rendu: (f) => formaterPourcentage(f.tauxCompletion),
            },
            {
              cle: 'reussite',
              entete: 'Réussite',
              nombre: true,
              rendu: (f) => formaterPourcentage(f.tauxReussite),
            },
            {
              cle: 'satisfaction',
              entete: 'Satisfaction',
              nombre: true,
              rendu: (f) => formaterSatisfaction(f.satisfaction.moyenne),
            },
          ]}
        />
      </Carte>
    </div>
  );
}
