import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { cles, entreprisesApi } from '../../api/ressources';
import { Bouton, ChampSelection } from '../../components/ui';
import { catalogueApi, clesCatalogue } from '../catalogue/api';
import type { FiltresIndicateurs } from './api';
import { bornesPeriode, PERIODES, type CodePeriode } from './periodes';

export interface SelectionFiltres {
  periode: CodePeriode;
  formationId: string;
  entrepriseId: string;
}

/** Filtres appliqués à la requête d'indicateurs. */
export function versFiltres(s: SelectionFiltres, jour: string): FiltresIndicateurs {
  return {
    ...bornesPeriode(s.periode, jour),
    formationId: s.formationId || undefined,
    entrepriseId: s.entrepriseId || undefined,
  };
}

/**
 * Filtres des tableaux de bord (RG-DASH-03) : période, formation et — pour l'administration
 * seulement — entreprise. Appliqués sur demande (bouton « Appliquer » des maquettes 09 et 21a).
 */
export function FiltresTableau({
  initial,
  avecEntreprise,
  onAppliquer,
}: {
  initial: SelectionFiltres;
  avecEntreprise: boolean;
  onAppliquer: (s: SelectionFiltres) => void;
}) {
  const [saisie, setSaisie] = useState(initial);
  const formations = useQuery({
    queryKey: clesCatalogue.formations({ limit: 100 }),
    queryFn: () => catalogueApi.formations({ limit: 100 }),
  });
  const entreprises = useQuery({
    queryKey: cles.entreprises({ limit: 100 }),
    queryFn: entreprisesApi.toutes,
    enabled: avecEntreprise,
  });

  const surEnvoi = (e: FormEvent) => {
    e.preventDefault();
    onAppliquer(saisie);
  };

  return (
    <form className="filtres" onSubmit={surEnvoi} aria-label="Filtres des indicateurs">
      <ChampSelection
        libelle="Période"
        value={saisie.periode}
        onChange={(e) => setSaisie({ ...saisie, periode: e.target.value as CodePeriode })}
        options={PERIODES}
      />
      <ChampSelection
        libelle="Formation"
        value={saisie.formationId}
        onChange={(e) => setSaisie({ ...saisie, formationId: e.target.value })}
        optionVide="Toutes"
        options={(formations.data?.donnees ?? []).map((f) => ({
          valeur: f.id,
          libelle: f.intitule,
        }))}
      />
      {avecEntreprise && (
        <ChampSelection
          libelle="Entreprise"
          value={saisie.entrepriseId}
          onChange={(e) => setSaisie({ ...saisie, entrepriseId: e.target.value })}
          optionVide="Toutes"
          options={(entreprises.data?.donnees ?? []).map((x) => ({
            valeur: x.id,
            libelle: x.raisonSociale,
          }))}
        />
      )}
      <Bouton type="submit" variante="secondaire">
        Appliquer
      </Bouton>
    </form>
  );
}
