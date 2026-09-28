import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import {
  Alerte,
  AlerteErreur,
  Bouton,
  CaseACocher,
  ChampZoneTexte,
  Dialogue,
  useNotifier,
} from '../../components/ui';
import { clesTableaux, reportingApi } from './api';

const NIVEAUX = [
  { score: 1, libelle: 'Pas du tout satisfait' },
  { score: 2, libelle: 'Peu satisfait' },
  { score: 3, libelle: 'Moyennement satisfait' },
  { score: 4, libelle: 'Satisfait' },
  { score: 5, libelle: 'Très satisfait' },
];

/**
 * Questionnaire de satisfaction (RG-DASH-04). Le consentement à la finalité « questionnaires de
 * satisfaction » est demandé explicitement, case non pré-cochée (RG-RGPD-01), s'il n'est pas
 * déjà actif.
 */
export function QuestionnaireSatisfaction({
  inscription,
  consentementActif,
  surFermeture,
}: {
  inscription: { inscriptionId: string; formation: string } | null;
  consentementActif: boolean;
  surFermeture: () => void;
}) {
  const client = useQueryClient();
  const notifier = useNotifier();
  const idLegende = useId();
  const [score, setScore] = useState<number | null>(null);
  const [commentaire, setCommentaire] = useState('');
  const [accord, setAccord] = useState(false);
  const [soumis, setSoumis] = useState(false);

  const envoyer = useMutation({
    mutationFn: () =>
      reportingApi.repondreSatisfaction(inscription!.inscriptionId, {
        score: score!,
        commentaire: commentaire.trim() || undefined,
        consentement: consentementActif || accord,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: clesTableaux.apprenant });
      notifier.succes('Merci, votre avis a été enregistré.');
      surFermeture();
    },
  });

  const manquants = [
    score === null && 'indiquez votre niveau de satisfaction',
    !consentementActif && !accord && 'cochez la case d’accord',
  ].filter(Boolean);

  const surEnvoi = (e: FormEvent) => {
    e.preventDefault();
    setSoumis(true);
    if (manquants.length === 0) envoyer.mutate();
  };

  return (
    <Dialogue
      ouvert={inscription !== null}
      surChangement={(ouvert) => !ouvert && surFermeture()}
      titre="Votre avis sur la formation"
      description={inscription?.formation}
    >
      <form onSubmit={surEnvoi} noValidate aria-label="Questionnaire de satisfaction">
        {soumis && manquants.length > 0 && (
          <Alerte type="erreur" titre="Réponse incomplète">
            <p>Pour envoyer votre avis, {manquants.join(' et ')}.</p>
          </Alerte>
        )}
        {envoyer.error && <AlerteErreur erreur={envoyer.error} />}
        <fieldset className="champ" aria-describedby={idLegende}>
          <legend className="champ__libelle">
            Satisfaction globale{' '}
            <span className="champ__obligatoire" aria-hidden="true">
              *
            </span>
          </legend>
          <p className="champ__indice" id={idLegende}>
            De 1 (pas du tout satisfait) à 5 (très satisfait).
          </p>
          {NIVEAUX.map((n) => (
            <div className="case" key={n.score}>
              <input
                type="radio"
                id={`${idLegende}-${n.score}`}
                name="score"
                value={n.score}
                checked={score === n.score}
                onChange={() => setScore(n.score)}
                required
              />
              <label htmlFor={`${idLegende}-${n.score}`}>
                {n.score} — {n.libelle}
              </label>
            </div>
          ))}
        </fieldset>
        <ChampZoneTexte
          libelle="Commentaire (facultatif)"
          indice="1 000 caractères au plus. Évitez d’y mentionner des données personnelles."
          maxLength={1000}
          value={commentaire}
          onChange={(e) => setCommentaire(e.target.value)}
        />
        {consentementActif ? (
          <p className="note">
            Vous avez accepté que vos réponses servent à mesurer la satisfaction. Vous pouvez
            retirer cet accord depuis « Mes données (RGPD) ».
          </p>
        ) : (
          <CaseACocher
            libelle="J’accepte que ma réponse soit utilisée pour mesurer la satisfaction des formations."
            indice="Finalité « questionnaires de satisfaction » : réponses conservées 24 mois puis anonymisées. Accord révocable à tout moment."
            checked={accord}
            onChange={(e) => setAccord(e.target.checked)}
          />
        )}
        <div className="dialogue__actions">
          <Bouton variante="secondaire" onClick={surFermeture}>
            Plus tard
          </Bouton>
          <Bouton type="submit" chargement={envoyer.isPending}>
            Envoyer mon avis
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}
