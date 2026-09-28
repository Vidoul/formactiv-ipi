import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  BadgeStatut,
  Bouton,
  Carte,
  Chargement,
  EnTetePage,
  EtatVide,
  messageErreur,
  Tableau,
  useNotifier,
} from '../../components/ui';
import { formaterDate } from '../../utils/formatage';
import { TYPES_DOCUMENT } from '../../utils/libelles';
import { clesDocuments, documentsApi, type DocumentDetail } from './api';

const requete = { limit: 100 };

/** Écran Figma 20 — Mes attestations et certificats (UC-10, US-20). */
export default function PageMesDocuments() {
  usePage('Mes documents');
  const notifier = useNotifier();
  const [enCours, setEnCours] = useState<string | null>(null);
  const documents = useQuery({
    queryKey: clesDocuments.documents(requete),
    queryFn: () => documentsApi.lister(requete),
  });

  const telecharger = async (d: DocumentDetail) => {
    setEnCours(d.id);
    try {
      await documentsApi.telecharger(d.id);
    } catch (erreur) {
      notifier.erreur(messageErreur(erreur));
    } finally {
      setEnCours(null);
    }
  };

  return (
    <>
      <EnTetePage
        titre="Mes attestations et certificats"
        sousTitre="Documents officiels générés au fil de votre parcours."
      />
      {documents.error && <AlerteErreur erreur={documents.error} />}
      {documents.isPending && <Chargement />}
      {documents.data &&
        (documents.data.total === 0 ? (
          <EtatVide titre="Aucun document pour le moment">
            <p>
              Vos attestations et certificats apparaîtront ici dès leur génération par le
              responsable formation, à l’issue de vos sessions.
            </p>
          </EtatVide>
        ) : (
          <Carte legende="Documents disponibles">
            <Tableau
              legende="Mes attestations et certificats"
              legendeMasquee
              lignes={documents.data.donnees}
              cleLigne={(d) => d.id}
              colonnes={[
                {
                  cle: 'type',
                  entete: 'Document',
                  rendu: (d) => <BadgeStatut statut={d.type} libelles={TYPES_DOCUMENT} />,
                },
                {
                  cle: 'reference',
                  entete: 'Référence',
                  enteteLigne: true,
                  rendu: (d) => d.reference,
                },
                { cle: 'formation', entete: 'Formation', rendu: (d) => d.formation.intitule },
                {
                  cle: 'date',
                  entete: 'Généré le',
                  rendu: (d) => formaterDate(d.dateGeneration),
                },
                {
                  cle: 'telechargement',
                  entete: 'Téléchargement',
                  rendu: (d) => (
                    <Bouton
                      petit
                      chargement={enCours === d.id}
                      onClick={() => void telecharger(d)}
                      aria-label={`Télécharger ${TYPES_DOCUMENT[d.type].libelle.toLowerCase()} ${d.reference} (PDF)`}
                    >
                      Télécharger (PDF)
                    </Bouton>
                  ),
                },
              ]}
            />
            <p className="note">
              Les PDF sont balisés pour les lecteurs d’écran et portent la référence unique et
              l’émetteur. Le lien de téléchargement est personnel et valable quelques minutes.
            </p>
          </Carte>
        ))}
    </>
  );
}
