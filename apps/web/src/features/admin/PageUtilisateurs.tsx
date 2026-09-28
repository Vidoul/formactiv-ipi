import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { cles, entreprisesApi, utilisateursApi } from '../../api/ressources';
import type { CodeRole, StatutCompte } from '../../api/types';
import { usePage } from '../../components/layout/ContextePage';
import {
  AlerteErreur,
  BadgeStatut,
  Bouton,
  Carte,
  ChampSelection,
  Chargement,
  EnTetePage,
  Pagination,
  Tableau,
} from '../../components/ui';
import { formaterNombre } from '../../utils/formatage';
import { ROLES, STATUTS_COMPTE } from '../../utils/libelles';
import { FicheCompte } from './FicheCompte';

interface Filtres {
  role: string;
  entrepriseId: string;
  statut: string;
}

const FILTRES_VIDES: Filtres = { role: '', entrepriseId: '', statut: '' };

/** Écran Figma 06 — Utilisateurs : liste filtrée et fiche compte (UC-03, US-01/02). */
export default function PageUtilisateurs() {
  usePage('Utilisateurs');
  const [parametres, setParametres] = useSearchParams();
  const compteOuvert = parametres.get('compte');
  const creation = parametres.get('creation') === '1';

  const [saisie, setSaisie] = useState<Filtres>(FILTRES_VIDES);
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_VIDES);
  const [page, setPage] = useState(1);

  const requete = { ...filtres, page, limit: 10 };
  const liste = useQuery({
    queryKey: cles.utilisateurs(requete),
    queryFn: () => utilisateursApi.lister(requete),
    placeholderData: keepPreviousData,
  });
  const entreprises = useQuery({
    queryKey: cles.entreprises({ limit: 100 }),
    queryFn: entreprisesApi.toutes,
  });

  const ouvrir = (id: string | null, nouveau = false) => {
    const suivant = new URLSearchParams(parametres);
    suivant.delete('compte');
    suivant.delete('creation');
    if (id) suivant.set('compte', id);
    if (nouveau) suivant.set('creation', '1');
    setParametres(suivant);
  };

  const appliquer = (evenement: FormEvent) => {
    evenement.preventDefault();
    setPage(1);
    setFiltres(saisie);
  };

  const pages = liste.data ? Math.max(1, Math.ceil(liste.data.total / liste.data.limit)) : 1;

  return (
    <>
      <EnTetePage
        titre="Utilisateurs"
        sousTitre={
          liste.data
            ? `${formaterNombre(liste.data.total)} comptes — filtres par rôle, entreprise ou statut.`
            : 'Filtres par rôle, entreprise ou statut.'
        }
      />

      <form className="filtres" onSubmit={appliquer} aria-label="Filtrer les comptes">
        <ChampSelection
          libelle="Rôle"
          value={saisie.role}
          onChange={(e) => setSaisie({ ...saisie, role: e.target.value })}
          optionVide="Tous les rôles"
          options={(Object.keys(ROLES) as CodeRole[]).map((r) => ({
            valeur: r,
            libelle: ROLES[r],
          }))}
        />
        <ChampSelection
          libelle="Entreprise"
          value={saisie.entrepriseId}
          onChange={(e) => setSaisie({ ...saisie, entrepriseId: e.target.value })}
          optionVide="Toutes"
          options={(entreprises.data?.donnees ?? []).map((e) => ({
            valeur: e.id,
            libelle: e.raisonSociale,
          }))}
        />
        <ChampSelection
          libelle="Statut"
          value={saisie.statut}
          onChange={(e) => setSaisie({ ...saisie, statut: e.target.value })}
          optionVide="Tous"
          options={(Object.keys(STATUTS_COMPTE) as StatutCompte[]).map((s) => ({
            valeur: s,
            libelle: STATUTS_COMPTE[s].libelle,
          }))}
        />
        <Bouton type="submit" variante="secondaire">
          Appliquer
        </Bouton>
      </form>

      <div className="grille grille--2-1">
        <Carte titre="Liste des comptes">
          {liste.error && <AlerteErreur erreur={liste.error} />}
          {liste.isPending ? (
            <Chargement />
          ) : (
            <>
              <Tableau
                legende={`Comptes utilisateurs (page ${page} sur ${pages})`}
                lignes={liste.data?.donnees ?? []}
                cleLigne={(u) => u.id}
                vide="Aucun compte ne correspond à ces filtres."
                colonnes={[
                  {
                    cle: 'nom',
                    entete: 'Nom',
                    enteteLigne: true,
                    rendu: (u) => `${u.nom} ${u.prenom}`,
                  },
                  { cle: 'email', entete: 'Email', rendu: (u) => u.email },
                  { cle: 'role', entete: 'Rôle', rendu: (u) => ROLES[u.role] },
                  {
                    cle: 'statut',
                    entete: 'Statut',
                    rendu: (u) => <BadgeStatut statut={u.statut} libelles={STATUTS_COMPTE} />,
                  },
                  {
                    cle: 'action',
                    entete: <span className="sr-only">Action</span>,
                    rendu: (u) => (
                      <Bouton
                        variante="secondaire"
                        petit
                        onClick={() => ouvrir(u.id)}
                        aria-pressed={compteOuvert === u.id}
                      >
                        Ouvrir
                        <span className="sr-only">
                          {' '}
                          la fiche de {u.prenom} {u.nom}
                        </span>
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
                  elements="comptes"
                />
              )}
            </>
          )}
          <div style={{ marginTop: 'var(--espace-4)' }}>
            <Bouton onClick={() => ouvrir(null, true)}>Créer un compte</Bouton>
          </div>
        </Carte>

        <Carte titre={creation ? 'Nouveau compte' : 'Fiche compte'}>
          {creation || compteOuvert ? (
            <FicheCompte
              id={creation ? null : compteOuvert}
              surFermeture={() => ouvrir(null)}
              surCreation={(id) => ouvrir(id)}
            />
          ) : (
            <p className="champ__indice">
              Sélectionnez un compte dans la liste pour afficher sa fiche.
            </p>
          )}
        </Carte>
      </div>
    </>
  );
}
