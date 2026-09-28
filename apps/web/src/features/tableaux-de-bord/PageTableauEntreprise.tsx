import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useUtilisateur } from '../../auth/ContexteAuth';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  Bouton,
  Carte,
  Chargement,
  EnTetePage,
  GraphiqueBarres,
  Indicateur,
  messageErreur,
  Progression,
  useNotifier,
} from '../../components/ui';
import { formaterNombre, formaterPourcentage, formaterSatisfaction } from '../../utils/formatage';
import { documentsApi, type DemandeExport } from '../documents/api';
import { clesTableaux, reportingApi, type FiltresIndicateurs, type Indicateurs } from './api';
import { FiltresTableau, versFiltres, type SelectionFiltres } from './FiltresTableau';
import { jourParis } from './periodes';

/**
 * Écran Figma 21a — Suivi des formations de l'entreprise cliente (US-26) : indicateurs agrégés
 * limités à ses salariés (RG-DASH-02, minimisation RGPD) et exports (RG-EXP-01).
 */
export default function PageTableauEntreprise() {
  usePage('Tableau de bord');
  const moi = useUtilisateur();
  const [selection, setSelection] = useState<SelectionFiltres>({
    periode: 'annee',
    formationId: '',
    entrepriseId: '',
  });
  const filtres = versFiltres(selection, jourParis());
  const requete = useQuery({
    queryKey: clesTableaux.indicateurs(filtres),
    queryFn: () => reportingApi.indicateurs(filtres),
  });
  const raisonSociale = moi.entreprise?.raisonSociale ?? 'Mon entreprise';

  return (
    <>
      <EnTetePage
        titre={`${raisonSociale} - Suivi des formations`}
        sousTitre="Vue limitée à vos salariés (minimisation RGPD)."
      />
      <FiltresTableau initial={selection} avecEntreprise={false} onAppliquer={setSelection} />
      {requete.error && <AlerteErreur erreur={requete.error} />}
      {requete.isPending && <Chargement />}
      {requete.data && <Contenu donnees={requete.data} filtres={filtres} />}
    </>
  );
}

function Contenu({ donnees, filtres }: { donnees: Indicateurs; filtres: FiltresIndicateurs }) {
  const notifier = useNotifier();
  const [enCours, setEnCours] = useState<string | null>(null);
  const i = donnees.indicateurs;

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
  const perimetre = { du: filtres.du, au: filtres.au, formationId: filtres.formationId };
  const plusieursAnnees =
    new Set(donnees.parTrimestre.map((t) => t.trimestre.slice(0, 4))).size > 1;

  return (
    <div className="pile">
      <div className="grille grille--indicateurs">
        <Indicateur valeur={formaterNombre(i.apprenants)} libelle="Salariés en formation" />
        <Indicateur valeur={formaterPourcentage(i.tauxCompletion)} libelle="Taux de complétion" />
        <Indicateur valeur={formaterNombre(i.certificats)} libelle="Certificats obtenus" />
        <Indicateur
          valeur={formaterSatisfaction(i.satisfaction.moyenne)}
          libelle="Satisfaction"
          complement={`${formaterNombre(i.satisfaction.reponses)} réponse${i.satisfaction.reponses > 1 ? 's' : ''}`}
        />
      </div>
      <div className="grille grille--2">
        <Carte titre="Salariés formés par trimestre">
          <GraphiqueBarres
            titre="Salariés formés par trimestre"
            serie="Salariés en formation"
            donnees={donnees.parTrimestre.map((t) => {
              const [annee, numero] = t.trimestre.split('-');
              const court = plusieursAnnees ? `${numero} ${annee.slice(2)}` : numero;
              return {
                libelle: `${court}${t.previsionnel ? ' (prév.)' : ''}`,
                libelleLong: `${numero} ${annee}${t.previsionnel ? ' (prévision)' : ''}`,
                valeur: t.apprenants,
              };
            })}
          />
        </Carte>
        <Carte titre="Répartition par formation">
          {donnees.parFormation.length === 0 ? (
            <p>Aucune inscription sur la période.</p>
          ) : (
            <ul className="pile" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {donnees.parFormation.map((f) => (
                <li key={f.formation.id}>
                  <Progression
                    libelle={f.formation.intitule}
                    pourcentage={(f.part ?? 0) * 100}
                    texteValeur={`${formaterPourcentage(f.part)} — ${f.inscriptions} inscription${f.inscriptions > 1 ? 's' : ''}`}
                  />
                </li>
              ))}
            </ul>
          )}
          <p className="note">Part des inscriptions de la période (en pourcentage).</p>
        </Carte>
      </div>
      <div className="rangee">
        <Bouton
          variante="secondaire"
          chargement={enCours === 'pdf'}
          onClick={() => void exporter('pdf', { jeu: 'resultats', format: 'pdf', ...perimetre })}
        >
          Exporter le bilan (PDF)
        </Bouton>
        <Bouton
          variante="secondaire"
          chargement={enCours === 'csv'}
          onClick={() => void exporter('csv', { jeu: 'evaluations', format: 'csv', ...perimetre })}
        >
          Exporter le détail (CSV)
        </Bouton>
      </div>
    </div>
  );
}
