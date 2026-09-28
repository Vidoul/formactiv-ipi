import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router';
import { useUtilisateur } from '../../auth/ContexteAuth';
import { usePage } from '../../components/layout/ContextePage';
import {
  Alerte,
  AlerteErreur,
  Bouton,
  Carte,
  Chargement,
  EnTetePage,
  Indicateur,
  Progression,
  Tableau,
} from '../../components/ui';
import { formaterNombre, formaterPlageDates } from '../../utils/formatage';
import { MODALITES } from '../../utils/libelles';
import { clesTableaux, reportingApi, type TableauApprenant } from './api';
import { QuestionnaireSatisfaction } from './QuestionnaireSatisfaction';

type Etape = TableauApprenant['progression'][number];

/** « Terminée — certificat obtenu », « En cours — 60 % », « À venir » (maquette 18). */
export function libelleProgression(e: Etape): string {
  const pourcentage =
    e.competencesVisees === 0 ? 0 : Math.round((e.competencesAcquises / e.competencesVisees) * 100);
  if (e.etat === 'A_VENIR') {
    return e.statut === 'EN_ATTENTE' ? 'À venir — inscription en attente' : 'À venir';
  }
  if (e.etat === 'EN_COURS') return `En cours — ${pourcentage} %`;
  if (e.document === 'CERTIFICAT') return 'Terminée — certificat obtenu';
  if (e.document === 'ATTESTATION') return 'Terminée — attestation disponible';
  return `Terminée — ${e.competencesAcquises} / ${pluriel(e.competencesVisees, 'compétence')}`;
}

function pluriel(n: number, mot: string): string {
  return `${n} ${mot}${n > 1 ? 's' : ''}`;
}

/** « 1 certificat, 2 attestations » en omettant les types absents. */
export function detailDocuments(d: TableauApprenant['documents']): string {
  return [
    d.certificats > 0 && pluriel(d.certificats, 'certificat'),
    d.attestations > 0 && pluriel(d.attestations, 'attestation'),
  ]
    .filter(Boolean)
    .join(', ');
}

/** Écran Figma 18 — Mon tableau de bord : progression et prochaines échéances (US-26). */
export default function PageTableauApprenant() {
  usePage('Mon tableau de bord');
  const moi = useUtilisateur();
  const requete = useQuery({ queryKey: clesTableaux.apprenant, queryFn: reportingApi.apprenant });
  const [questionnaire, setQuestionnaire] = useState<{
    inscriptionId: string;
    formation: string;
  } | null>(null);
  // Nouvelle instance du formulaire à chaque ouverture (réponse vierge) ; la clé ne change pas à
  // la fermeture pour que la fenêtre rende le focus à son déclencheur (RGAA 7.1).
  const [ouvertures, setOuvertures] = useState(0);
  const ouvrir = (s: { inscriptionId: string; formation: string }) => {
    setOuvertures((n) => n + 1);
    setQuestionnaire(s);
  };
  const t = requete.data;

  return (
    <>
      <EnTetePage
        titre={`Bonjour ${moi.prenom}`}
        sousTitre="Votre progression et vos prochaines échéances."
      />
      {requete.error && <AlerteErreur erreur={requete.error} />}
      {requete.isPending && <Chargement />}
      {t && (
        <div className="pile">
          {t.satisfactionAttendue.length > 0 && (
            <Alerte type="info" titre="Votre avis nous intéresse">
              <p>Donnez votre avis sur les formations que vous avez terminées :</p>
              <ul className="rangee" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {t.satisfactionAttendue.map((s) => (
                  <li key={s.inscriptionId}>
                    <Bouton
                      petit
                      variante="secondaire"
                      onClick={() => ouvrir(s)}
                      aria-label={`Donner mon avis sur ${s.formation}`}
                    >
                      {s.formation}
                    </Bouton>
                  </li>
                ))}
              </ul>
            </Alerte>
          )}
          <div className="grille grille--indicateurs">
            <Indicateur valeur={formaterNombre(t.formationsSuivies)} libelle="Formations suivies" />
            <Indicateur
              valeur={`${t.competences.acquises} / ${t.competences.total}`}
              libelle="Compétences acquises"
            />
            <Indicateur
              valeur={formaterNombre(t.documents.total)}
              libelle="Documents disponibles"
              complement={
                t.documents.total > 0 ? (
                  <Link to="/mes-documents">{detailDocuments(t.documents)}</Link>
                ) : undefined
              }
            />
          </div>
          <div className="grille grille--2">
            <Carte titre="Ma progression par formation">
              {t.progression.length === 0 ? (
                <p>Aucune inscription pour le moment.</p>
              ) : (
                <ul className="pile" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {t.progression.map((e) => (
                    <li key={e.inscriptionId}>
                      <Progression
                        libelle={e.formation}
                        pourcentage={
                          e.etat === 'A_VENIR' || e.competencesVisees === 0
                            ? 0
                            : (e.competencesAcquises / e.competencesVisees) * 100
                        }
                        texteValeur={libelleProgression(e)}
                        couleur={e.document === 'CERTIFICAT' ? 'vert' : 'bleu'}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <p className="note">
                <Link to="/mon-parcours">Voir mon parcours complet</Link>
              </p>
            </Carte>
            <Carte titre="Prochaines sessions">
              <Tableau
                legende="Sessions à venir"
                lignes={t.prochainesSessions}
                cleLigne={(s) => s.inscriptionId}
                vide="Aucune session à venir."
                colonnes={[
                  {
                    cle: 'formation',
                    entete: 'Formation',
                    enteteLigne: true,
                    rendu: (s) => s.formation,
                  },
                  {
                    cle: 'dates',
                    entete: 'Dates',
                    rendu: (s) => formaterPlageDates(s.dateDebut, s.dateFin),
                  },
                  {
                    cle: 'modalite',
                    entete: 'Modalité',
                    rendu: (s) =>
                      s.lieu && s.modalite !== 'DISTANCIEL'
                        ? `${MODALITES[s.modalite]} - ${s.lieu}`
                        : MODALITES[s.modalite],
                  },
                ]}
              />
            </Carte>
          </div>
          <QuestionnaireSatisfaction
            key={ouvertures}
            inscription={questionnaire}
            consentementActif={t.consentementSatisfaction}
            surFermeture={() => setQuestionnaire(null)}
          />
        </div>
      )}
    </>
  );
}
