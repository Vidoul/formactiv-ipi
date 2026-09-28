import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ErreurApi } from '../../api/client';
import type { Modalite, StatutFormation } from '../../api/types';
import {
  AlerteErreur,
  Bouton,
  ChampSelection,
  ChampTexte,
  ChampZoneTexte,
  Chargement,
  DialogueConfirmation,
  useNotifier,
} from '../../components/ui';
import { MODALITES } from '../../utils/libelles';
import {
  catalogueApi,
  clesCatalogue,
  etiquetteCompetence,
  type CompetenceResume,
  type FormationDetail,
} from './api';

interface Props {
  id: string | null;
  surCreation: (id: string) => void;
  surFermeture: () => void;
}

/** Fiche formation de l'écran Figma 10 (UC-04 : paramétrage, compétences, publication). */
export function FicheFormation({ id, surCreation, surFermeture }: Props) {
  const detail = useQuery({
    queryKey: clesCatalogue.formation(id ?? 'nouvelle'),
    queryFn: () => catalogueApi.formation(id!),
    enabled: id !== null,
  });
  if (id && detail.isPending) return <Chargement />;
  if (id && detail.error) return <AlerteErreur erreur={detail.error} />;
  return (
    <Formulaire
      key={id ?? 'nouvelle'}
      formation={id ? (detail.data ?? null) : null}
      surCreation={surCreation}
      surFermeture={surFermeture}
    />
  );
}

function Formulaire({
  formation,
  surCreation,
  surFermeture,
}: {
  formation: FormationDetail | null;
  surCreation: (id: string) => void;
  surFermeture: () => void;
}) {
  const client = useQueryClient();
  const notifier = useNotifier();
  const [intitule, setIntitule] = useState(formation?.intitule ?? '');
  const [duree, setDuree] = useState(formation ? String(formation.dureeHeures) : '');
  const [modalite, setModalite] = useState<Modalite>(formation?.modalite ?? 'PRESENTIEL');
  const [prerequis, setPrerequis] = useState(formation?.prerequis ?? '');
  const [seuil, setSeuil] = useState(formation ? String(formation.seuilAcquisition) : '');
  // Compétences choisies avant la première sauvegarde d'une nouvelle formation.
  const [competencesNouvelles, setCompetencesNouvelles] = useState<CompetenceResume[]>([]);
  const [aAjouter, setAAjouter] = useState('');
  const [confirmationSuppression, setConfirmationSuppression] = useState(false);

  const referentiel = useQuery({
    queryKey: clesCatalogue.competences({ limit: 100 }),
    queryFn: catalogueApi.toutesCompetences,
  });

  const rafraichir = (maj?: FormationDetail) => {
    void client.invalidateQueries({ queryKey: ['formations'] });
    if (maj) client.setQueryData(clesCatalogue.formation(maj.id), maj);
  };

  const enregistrer = useMutation({
    mutationFn: () => {
      const saisie = {
        intitule,
        dureeHeures: Number(duree),
        modalite,
        prerequis,
        ...(seuil !== '' ? { seuilAcquisition: Number(seuil.replace(',', '.')) } : {}),
      };
      return formation
        ? catalogueApi.modifierFormation(formation.id, saisie)
        : catalogueApi.creerFormation({
            ...saisie,
            competenceIds: competencesNouvelles.map((c) => c.id),
          });
    },
    onSuccess: (maj) => {
      rafraichir(maj);
      notifier.succes(formation ? 'Formation enregistrée.' : 'Formation créée en brouillon.');
      if (!formation) surCreation(maj.id);
    },
  });

  const changerStatut = useMutation({
    mutationFn: (statut: StatutFormation) =>
      catalogueApi.modifierFormation(formation!.id, { statut }),
    onSuccess: (maj) => {
      rafraichir(maj);
      notifier.succes(maj.statut === 'PUBLIEE' ? 'Formation publiée.' : 'Statut mis à jour.');
    },
    onError: (e) => notifier.erreur(e instanceof ErreurApi ? e.message : 'Action impossible.'),
  });

  const competences = useMutation({
    mutationFn: ({
      action,
      competenceId,
    }: {
      action: 'ajout' | 'retrait';
      competenceId: string;
    }) =>
      action === 'ajout'
        ? catalogueApi.ajouterCompetence(formation!.id, competenceId)
        : catalogueApi.retirerCompetence(formation!.id, competenceId),
    onSuccess: (maj) => {
      rafraichir(maj);
      setAAjouter('');
    },
    onError: (e) => notifier.erreur(e instanceof ErreurApi ? e.message : 'Action impossible.'),
  });

  const supprimer = useMutation({
    mutationFn: () => catalogueApi.supprimerFormation(formation!.id),
    onSuccess: () => {
      rafraichir();
      notifier.succes('Formation supprimée.');
      surFermeture();
    },
    onError: (e) => {
      setConfirmationSuppression(false);
      notifier.erreur(e instanceof ErreurApi ? e.message : 'Suppression impossible.');
    },
  });

  const visees = formation?.competences ?? competencesNouvelles;
  const disponibles = (referentiel.data?.donnees ?? []).filter(
    (c) => !visees.some((v) => v.id === c.id),
  );

  const ajouter = () => {
    const choisie = disponibles.find((c) => c.id === aAjouter);
    if (!choisie) return;
    if (formation) competences.mutate({ action: 'ajout', competenceId: choisie.id });
    else {
      setCompetencesNouvelles((l) => [...l, choisie]);
      setAAjouter('');
    }
  };
  const retirer = (c: CompetenceResume) => {
    if (formation) competences.mutate({ action: 'retrait', competenceId: c.id });
    else setCompetencesNouvelles((l) => l.filter((x) => x.id !== c.id));
  };

  const erreurs = enregistrer.error instanceof ErreurApi ? enregistrer.error.erreursChamps : {};
  const surEnvoi = (e: FormEvent) => {
    e.preventDefault();
    enregistrer.mutate();
  };

  return (
    <form
      onSubmit={surEnvoi}
      noValidate
      aria-label={formation ? 'Fiche formation' : 'Nouvelle formation'}
    >
      {enregistrer.error && Object.keys(erreurs).length === 0 && (
        <AlerteErreur erreur={enregistrer.error} />
      )}
      <ChampTexte
        libelle="Intitulé"
        value={intitule}
        onChange={(e) => setIntitule(e.target.value)}
        erreur={erreurs.intitule}
        obligatoire
      />
      <div className="formulaire-ligne">
        <ChampTexte
          libelle="Durée (heures)"
          type="number"
          min={1}
          max={2000}
          value={duree}
          onChange={(e) => setDuree(e.target.value)}
          erreur={erreurs.dureeHeures}
          obligatoire
        />
        <ChampSelection
          libelle="Modalité"
          value={modalite}
          onChange={(e) => setModalite(e.target.value as Modalite)}
          options={(Object.keys(MODALITES) as Modalite[]).map((m) => ({
            valeur: m,
            libelle: MODALITES[m],
          }))}
          obligatoire
        />
      </div>
      <ChampZoneTexte
        libelle="Prérequis"
        value={prerequis}
        onChange={(e) => setPrerequis(e.target.value)}
        indice="Laisser vide si aucun prérequis (« Aucun »)."
        erreur={erreurs.prerequis}
        rows={2}
      />
      <ChampTexte
        libelle="Seuil d’acquisition (sur 20)"
        inputMode="decimal"
        value={seuil}
        onChange={(e) => setSeuil(e.target.value)}
        indice="Une compétence est acquise lorsque la note atteint ce seuil (RG-EVAL-02). 10 par défaut."
        erreur={erreurs.seuilAcquisition}
      />

      <fieldset className="groupe">
        <legend>Compétences visées (RG-FORM-02)</legend>
        {visees.length === 0 ? (
          <p className="champ__indice">
            Aucune compétence : au moins une est requise pour publier.
          </p>
        ) : (
          <ul className="puces">
            {visees.map((c) => (
              <li
                key={c.id}
                className={`puce${c.typeReferentiel === 'INTERNE' ? ' puce--interne' : ''}`}
              >
                {etiquetteCompetence(c)}
                <button
                  type="button"
                  className="puce__retrait"
                  onClick={() => retirer(c)}
                  aria-label={`Retirer la compétence ${c.libelle}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="rangee" style={{ alignItems: 'flex-end' }}>
          <ChampSelection
            libelle="Ajouter une compétence"
            value={aAjouter}
            onChange={(e) => setAAjouter(e.target.value)}
            optionVide="Choisir dans les référentiels"
            options={disponibles.map((c) => ({ valeur: c.id, libelle: etiquetteCompetence(c) }))}
            className="sans-marge"
          />
          <Bouton variante="secondaire" petit onClick={ajouter} disabled={!aAjouter}>
            Ajouter
          </Bouton>
        </div>
      </fieldset>

      <div className="rangee">
        <Bouton type="submit" chargement={enregistrer.isPending}>
          Enregistrer
        </Bouton>
        {formation && formation.statut !== 'PUBLIEE' && (
          <Bouton variante="secondaire" onClick={() => changerStatut.mutate('PUBLIEE')}>
            Publier
          </Bouton>
        )}
        {formation?.statut === 'PUBLIEE' && (
          <Bouton variante="secondaire" onClick={() => changerStatut.mutate('ARCHIVEE')}>
            Archiver
          </Bouton>
        )}
        {formation?.statut === 'BROUILLON' && formation.nombreSessions === 0 && (
          <Bouton variante="danger" onClick={() => setConfirmationSuppression(true)}>
            Supprimer
          </Bouton>
        )}
        {!formation && (
          <Bouton variante="secondaire" onClick={surFermeture}>
            Annuler
          </Bouton>
        )}
      </div>
      {formation && (
        <DialogueConfirmation
          ouvert={confirmationSuppression}
          surChangement={setConfirmationSuppression}
          titre={`Supprimer « ${formation.intitule} » ?`}
          message="Ce brouillon sera définitivement supprimé."
          libelleConfirmation="Supprimer"
          surConfirmation={() => supprimer.mutate()}
          chargement={supprimer.isPending}
          danger
        />
      )}
    </form>
  );
}
