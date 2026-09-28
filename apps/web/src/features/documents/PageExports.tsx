import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { cles, entreprisesApi } from '../../api/ressources';
import { useUtilisateur } from '../../auth/ContexteAuth';
import { usePage } from '../../components/layout/ContextePage';
import {
  Alerte,
  AlerteErreur,
  Bouton,
  Carte,
  ChampSelection,
  ChampTexte,
  EnTetePage,
  useNotifier,
} from '../../components/ui';
import { formaterPlageDates } from '../../utils/formatage';
import { catalogueApi, clesCatalogue } from '../catalogue/api';
import { clesSessions, sessionsApi } from '../sessions/api';
import { documentsApi, type FormatExport, type JeuExport } from './api';

const JEUX: { valeur: JeuExport; libelle: string }[] = [
  { valeur: 'resultats', libelle: 'Résultats par apprenant (synthèse)' },
  { valeur: 'evaluations', libelle: 'Évaluations par compétence (détail)' },
  { valeur: 'inscriptions', libelle: 'Inscriptions' },
];

const FORMATS: { valeur: FormatExport; libelle: string }[] = [
  { valeur: 'csv', libelle: 'CSV (tableur)' },
  { valeur: 'pdf', libelle: 'PDF (document imprimable)' },
];

/**
 * UC-11 — Exporter des données (US-22) : choix du périmètre et du format. Le fichier ne contient
 * que les données de la portée du rôle (RG-EXP-01) ; le filtre entreprise est réservé à
 * l'administration (RG-DASH-03).
 */
export default function PageExports() {
  usePage('Exports');
  const moi = useUtilisateur();
  const notifier = useNotifier();
  const administration = moi.role === 'ADMIN' || moi.role === 'RESP_FORMATION';
  const [saisie, setSaisie] = useState({
    jeu: 'resultats' as JeuExport,
    format: 'csv' as FormatExport,
    formationId: '',
    sessionId: '',
    entrepriseId: '',
    du: '',
    au: '',
  });
  const [erreur, setErreur] = useState<unknown>(null);
  const [enCours, setEnCours] = useState(false);

  const formations = useQuery({
    queryKey: clesCatalogue.formations({ limit: 100 }),
    queryFn: () => catalogueApi.formations({ limit: 100 }),
    enabled: administration,
  });
  const sessions = useQuery({
    queryKey: clesSessions.sessions({ limit: 100 }),
    queryFn: () => sessionsApi.lister({ limit: 100 }),
    enabled: administration,
  });
  const entreprises = useQuery({
    queryKey: cles.entreprises({ limit: 100 }),
    queryFn: entreprisesApi.toutes,
    enabled: administration,
  });
  const sessionsFiltrees = (sessions.data?.donnees ?? []).filter(
    (s) => !saisie.formationId || s.formation.id === saisie.formationId,
  );
  const periodeInvalide = saisie.du !== '' && saisie.au !== '' && saisie.du > saisie.au;

  const maj = (champ: keyof typeof saisie) => (valeur: string) =>
    setSaisie((s) => ({
      ...s,
      [champ]: valeur,
      ...(champ === 'formationId' ? { sessionId: '' } : {}),
    }));

  const surEnvoi = async (e: FormEvent) => {
    e.preventDefault();
    if (periodeInvalide) return;
    setErreur(null);
    setEnCours(true);
    try {
      await documentsApi.exporter({
        jeu: saisie.jeu,
        format: saisie.format,
        formationId: saisie.formationId || undefined,
        sessionId: saisie.sessionId || undefined,
        entrepriseId: saisie.entrepriseId || undefined,
        du: saisie.du || undefined,
        au: saisie.au || undefined,
      });
      notifier.succes('Export téléchargé.');
    } catch (err) {
      setErreur(err);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <>
      <EnTetePage
        titre="Exporter des données"
        sousTitre={
          administration
            ? 'Bilans hors plateforme au format PDF ou CSV (US-22).'
            : 'Données de vos salariés, au format PDF ou CSV.'
        }
      />
      <Carte legende="Périmètre et format">
        <form onSubmit={(e) => void surEnvoi(e)} noValidate aria-label="Paramètres de l’export">
          {erreur !== null && <AlerteErreur erreur={erreur} />}
          <div className="grille grille--2">
            <ChampSelection
              libelle="Données"
              value={saisie.jeu}
              onChange={(e) => maj('jeu')(e.target.value)}
              options={JEUX}
              indice={
                !administration && saisie.jeu === 'evaluations'
                  ? 'Synthèse acquise / non acquise, sans note détaillée.'
                  : undefined
              }
            />
            <ChampSelection
              libelle="Format"
              value={saisie.format}
              onChange={(e) => maj('format')(e.target.value)}
              options={FORMATS}
            />
            {administration && (
              <>
                <ChampSelection
                  libelle="Formation"
                  value={saisie.formationId}
                  onChange={(e) => maj('formationId')(e.target.value)}
                  optionVide="Toutes les formations"
                  options={(formations.data?.donnees ?? []).map((f) => ({
                    valeur: f.id,
                    libelle: f.intitule,
                  }))}
                />
                <ChampSelection
                  libelle="Session"
                  value={saisie.sessionId}
                  onChange={(e) => maj('sessionId')(e.target.value)}
                  optionVide="Toutes les sessions"
                  options={sessionsFiltrees.map((s) => ({
                    valeur: s.id,
                    libelle: `${s.formation.intitule} — ${formaterPlageDates(s.dateDebut, s.dateFin)}`,
                  }))}
                />
                <ChampSelection
                  libelle="Entreprise"
                  value={saisie.entrepriseId}
                  onChange={(e) => maj('entrepriseId')(e.target.value)}
                  optionVide="Toutes les entreprises"
                  options={(entreprises.data?.donnees ?? []).map((x) => ({
                    valeur: x.id,
                    libelle: x.raisonSociale,
                  }))}
                />
              </>
            )}
            <ChampTexte
              libelle="Sessions terminées à partir du"
              type="date"
              value={saisie.du}
              onChange={(e) => maj('du')(e.target.value)}
            />
            <ChampTexte
              libelle="Sessions commencées jusqu’au"
              type="date"
              value={saisie.au}
              onChange={(e) => maj('au')(e.target.value)}
              erreur={periodeInvalide ? 'La fin de période doit suivre son début.' : undefined}
            />
          </div>
          <div className="rangee" style={{ marginTop: 'var(--espace-4)' }}>
            <Bouton type="submit" chargement={enCours}>
              Exporter
            </Bouton>
          </div>
        </form>
      </Carte>
      <Alerte type="info">
        <p>
          Les exports ne contiennent que les données auxquelles votre rôle donne accès (RG-EXP-01)
          {administration ? '' : ' : vos salariés, sans note détaillée'}. Chaque export est tracé au
          journal d’audit.
        </p>
      </Alerte>
    </>
  );
}
