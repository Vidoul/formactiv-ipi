import { useQuery } from '@tanstack/react-query';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  Carte,
  Chargement,
  EnTetePage,
  EtatVide,
  Indicateur,
  Progression,
} from '../../components/ui';
import { formaterMoisAnnee, formaterNombre, formaterPourcentage } from '../../utils/formatage';
import { clesTableaux, reportingApi } from './api';

/** Écran Figma 17 — Mes groupes : progression des sessions animées (US-25, RG-DASH-02). */
export default function PageTableauFormateur() {
  usePage('Tableau de bord');
  const requete = useQuery({ queryKey: clesTableaux.formateur, queryFn: reportingApi.formateur });
  const t = requete.data;

  return (
    <>
      <EnTetePage titre="Mes groupes" sousTitre="Progression des sessions que j’anime." />
      {requete.error && <AlerteErreur erreur={requete.error} />}
      {requete.isPending && <Chargement />}
      {t && (
        <div className="pile">
          <div className="grille grille--indicateurs">
            <Indicateur valeur={formaterNombre(t.sessionsAVenir)} libelle="Sessions à venir" />
            <Indicateur valeur={formaterNombre(t.apprenantsSuivis)} libelle="Apprenants suivis" />
            <Indicateur
              valeur={formaterPourcentage(t.acquisitionMoyenne)}
              libelle="Acquisition moyenne"
              complement="sur mes sessions terminées"
            />
          </div>
          <Carte titre="Acquisition des compétences par session">
            {t.parSession.length === 0 ? (
              <EtatVide titre="Aucune session affectée">
                <p>Vos sessions apparaîtront ici dès votre affectation.</p>
              </EtatVide>
            ) : (
              <ul className="pile" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {t.parSession.map((s) => (
                  <li key={s.sessionId}>
                    <Progression
                      libelle={`${s.intitule} (${formaterMoisAnnee(s.dateDebut)})`}
                      pourcentage={(s.partValidee ?? 0) * 100}
                      texteValeur={
                        s.partValidee === null
                          ? 'aucun apprenant évalué'
                          : `${formaterPourcentage(s.partValidee)} — ${s.apprenants} apprenant${s.apprenants > 1 ? 's' : ''}`
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
            <p className="note">Part des compétences validées par les apprenants de la session.</p>
          </Carte>
        </div>
      )}
    </>
  );
}
