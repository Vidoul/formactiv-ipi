import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { api, ErreurApi } from '../../api/client';
import { usePage } from '../../components/layout/ContextePage';
import {
  Alerte,
  AlerteErreur,
  Bouton,
  Carte,
  ChampTexte,
  Chargement,
  EnTetePage,
  useNotifier,
} from '../../components/ui';
import { formaterDateHeure } from '../../utils/formatage';

interface Parametre {
  cle: string;
  valeur: string;
  description: string;
  type: 'entier' | 'roles' | 'texte';
  min?: number;
  max?: number;
  dateModification: string | null;
}

/**
 * Paramètres de la plateforme (Administrateur) : ils portent les hypothèses [À VALIDER] du
 * dossier de conception (durées de conservation, seuils de sécurité, MFA par rôle).
 */
export default function PageParametres() {
  usePage('Paramètres');
  const liste = useQuery({
    queryKey: ['parametres'],
    queryFn: () => api.get<Parametre[]>('/parametres'),
  });

  return (
    <>
      <EnTetePage
        titre="Paramètres de la plateforme"
        sousTitre="Chaque modification est contrôlée et tracée dans le journal d’audit."
      />
      <Alerte type="info">
        <p>
          Ces valeurs traduisent des hypothèses à valider avec FORMACTIV (dossier de conception) :
          elles peuvent être ajustées sans nouvelle livraison.
        </p>
      </Alerte>
      {liste.error && <AlerteErreur erreur={liste.error} />}
      {liste.isPending ? (
        <Chargement />
      ) : (
        <div className="grille grille--2">
          {liste.data?.map((p) => (
            <CarteParametre key={p.cle} parametre={p} />
          ))}
        </div>
      )}
    </>
  );
}

function CarteParametre({ parametre }: { parametre: Parametre }) {
  const client = useQueryClient();
  const notifier = useNotifier();
  const [valeur, setValeur] = useState(parametre.valeur);
  const modifier = useMutation({
    mutationFn: () =>
      api.patch<{ valeur: string }>(`/parametres/${encodeURIComponent(parametre.cle)}`, { valeur }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['parametres'] });
      notifier.succes('Paramètre enregistré.');
    },
  });
  const erreur =
    modifier.error instanceof ErreurApi
      ? (modifier.error.erreursChamps.valeur ?? modifier.error.message)
      : undefined;
  const indice =
    parametre.type === 'entier'
      ? `Entier entre ${parametre.min} et ${parametre.max}.`
      : parametre.type === 'roles'
        ? 'Codes de rôles séparés par des virgules (ADMIN, RESP_FORMATION, FORMATEUR, APPRENANT, CLIENT_ENTREPRISE).'
        : undefined;

  const surEnvoi = (e: FormEvent) => {
    e.preventDefault();
    modifier.mutate();
  };

  return (
    <Carte titre={parametre.description} niveauTitre={2}>
      <form onSubmit={surEnvoi} noValidate aria-label={parametre.description}>
        <ChampTexte
          libelle={<span className="tableau__mono">{parametre.cle}</span>}
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          inputMode={parametre.type === 'entier' ? 'numeric' : undefined}
          indice={indice}
          erreur={erreur}
        />
        <div className="rangee" style={{ justifyContent: 'space-between' }}>
          <Bouton
            type="submit"
            petit
            chargement={modifier.isPending}
            disabled={valeur === parametre.valeur}
          >
            Enregistrer
          </Bouton>
          <span className="note" style={{ margin: 0 }}>
            {parametre.dateModification
              ? `Modifié le ${formaterDateHeure(parametre.dateModification)}`
              : 'Valeur par défaut'}
          </span>
        </div>
      </form>
    </Carte>
  );
}
