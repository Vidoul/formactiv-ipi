import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ErreurApi } from '../../api/client';
import type { TypeReferentiel } from '../../api/types';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  Badge,
  Bouton,
  Carte,
  ChampSelection,
  ChampTexte,
  Chargement,
  Dialogue,
  EnTetePage,
  Pagination,
  Tableau,
  useNotifier,
} from '../../components/ui';
import { REFERENTIELS } from '../../utils/libelles';
import { catalogueApi, clesCatalogue, type Competence } from './api';

/** Écran Figma 11 — Référentiels de compétences RNCP et interne (US-08, RG-COMP-01). */
export default function PageCompetences() {
  usePage('Compétences');
  const [saisie, setSaisie] = useState({ referentiel: '', recherche: '' });
  const [filtres, setFiltres] = useState(saisie);
  const [page, setPage] = useState(1);
  const [edition, setEdition] = useState<Competence | 'nouvelle' | null>(null);

  const requete = { ...filtres, page, limit: 20 };
  const liste = useQuery({
    queryKey: clesCatalogue.competences(requete),
    queryFn: () => catalogueApi.competences(requete),
    placeholderData: keepPreviousData,
  });

  const appliquer = (e: FormEvent) => {
    e.preventDefault();
    setPage(1);
    setFiltres(saisie);
  };

  return (
    <>
      <EnTetePage
        titre="Référentiels de compétences"
        sousTitre="Référentiel RNCP importé et référentiel interne FORMACTIV."
      />
      <form className="filtres" onSubmit={appliquer} aria-label="Filtrer les compétences">
        <ChampSelection
          libelle="Référentiel"
          value={saisie.referentiel}
          onChange={(e) => setSaisie({ ...saisie, referentiel: e.target.value })}
          optionVide="Tous"
          options={(Object.keys(REFERENTIELS) as TypeReferentiel[]).map((r) => ({
            valeur: r,
            libelle: REFERENTIELS[r],
          }))}
        />
        <ChampTexte
          libelle="Recherche"
          type="search"
          placeholder="Mot-clé"
          value={saisie.recherche}
          onChange={(e) => setSaisie({ ...saisie, recherche: e.target.value })}
        />
        <Bouton type="submit" variante="secondaire">
          Appliquer
        </Bouton>
      </form>

      <Carte titre="Compétences" legende="Compétences (extrait)">
        {liste.error && <AlerteErreur erreur={liste.error} />}
        {liste.isPending ? (
          <Chargement />
        ) : (
          <>
            <Tableau
              legende="Compétences des référentiels"
              legendeMasquee
              lignes={liste.data?.donnees ?? []}
              cleLigne={(c) => c.id}
              vide="Aucune compétence ne correspond à ces critères."
              colonnes={[
                { cle: 'libelle', entete: 'Libellé', enteteLigne: true, rendu: (c) => c.libelle },
                {
                  cle: 'ref',
                  entete: 'Référentiel',
                  rendu: (c) => (
                    <Badge variante={c.typeReferentiel === 'RNCP' ? 'info' : 'neutre'}>
                      {REFERENTIELS[c.typeReferentiel]}
                    </Badge>
                  ),
                },
                { cle: 'code', entete: 'Code RNCP', rendu: (c) => c.codeRncp ?? '—' },
                {
                  cle: 'formations',
                  entete: 'Formations liées',
                  nombre: true,
                  rendu: (c) => c.nombreFormations,
                },
                {
                  cle: 'action',
                  entete: <span className="sr-only">Action</span>,
                  rendu: (c) => (
                    <Bouton variante="secondaire" petit onClick={() => setEdition(c)}>
                      Modifier<span className="sr-only"> {c.libelle}</span>
                    </Bouton>
                  ),
                },
              ]}
            />
            {liste.data && (
              <Pagination
                page={page}
                limit={liste.data.limit}
                total={liste.data.total}
                surChangement={setPage}
                elements="compétences"
              />
            )}
          </>
        )}
        <div style={{ marginTop: 'var(--espace-4)' }}>
          <Bouton onClick={() => setEdition('nouvelle')}>Créer une compétence interne</Bouton>
        </div>
      </Carte>

      {edition && (
        <DialogueCompetence
          competence={edition === 'nouvelle' ? null : edition}
          surFermeture={() => setEdition(null)}
        />
      )}
    </>
  );
}

function DialogueCompetence({
  competence,
  surFermeture,
}: {
  competence: Competence | null;
  surFermeture: () => void;
}) {
  const client = useQueryClient();
  const notifier = useNotifier();
  const [libelle, setLibelle] = useState(competence?.libelle ?? '');
  const [type, setType] = useState<TypeReferentiel>(competence?.typeReferentiel ?? 'INTERNE');
  const [codeRncp, setCodeRncp] = useState(competence?.codeRncp ?? '');

  const enregistrer = useMutation({
    mutationFn: () => {
      const saisie = {
        libelle,
        typeReferentiel: type,
        codeRncp: type === 'RNCP' ? codeRncp : null,
      };
      return competence
        ? catalogueApi.modifierCompetence(competence.id, saisie)
        : catalogueApi.creerCompetence(saisie);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['competences'] });
      notifier.succes('Compétence enregistrée.');
      surFermeture();
    },
  });
  const supprimer = useMutation({
    mutationFn: () => catalogueApi.supprimerCompetence(competence!.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['competences'] });
      notifier.succes('Compétence supprimée.');
      surFermeture();
    },
  });
  const erreurs = enregistrer.error instanceof ErreurApi ? enregistrer.error.erreursChamps : {};
  const surEnvoi = (e: FormEvent) => {
    e.preventDefault();
    enregistrer.mutate();
  };

  return (
    <Dialogue
      ouvert
      surChangement={(o) => !o && surFermeture()}
      titre={competence ? 'Modifier la compétence' : 'Nouvelle compétence'}
      description="Un libellé est unique au sein d’un référentiel (RG-COMP-01)."
    >
      <form onSubmit={surEnvoi} noValidate aria-label="Compétence">
        {(enregistrer.error && Object.keys(erreurs).length === 0) || supprimer.error ? (
          <AlerteErreur erreur={enregistrer.error ?? supprimer.error} />
        ) : null}
        <ChampTexte
          libelle="Libellé"
          value={libelle}
          onChange={(e) => setLibelle(e.target.value)}
          erreur={erreurs.libelle}
          obligatoire
        />
        <ChampSelection
          libelle="Référentiel"
          value={type}
          onChange={(e) => setType(e.target.value as TypeReferentiel)}
          options={(Object.keys(REFERENTIELS) as TypeReferentiel[]).map((r) => ({
            valeur: r,
            libelle: REFERENTIELS[r],
          }))}
          obligatoire
        />
        {type === 'RNCP' && (
          <ChampTexte
            libelle="Code RNCP"
            value={codeRncp}
            onChange={(e) => setCodeRncp(e.target.value.toUpperCase())}
            placeholder="RNCP36125-C2"
            erreur={erreurs.codeRncp}
            obligatoire
          />
        )}
        <div className="dialogue__actions">
          {competence && competence.nombreFormations === 0 && (
            <Bouton
              variante="danger"
              onClick={() => supprimer.mutate()}
              chargement={supprimer.isPending}
            >
              Supprimer
            </Bouton>
          )}
          <Bouton variante="secondaire" onClick={surFermeture}>
            Annuler
          </Bouton>
          <Bouton type="submit" chargement={enregistrer.isPending}>
            Enregistrer
          </Bouton>
        </div>
      </form>
    </Dialogue>
  );
}
