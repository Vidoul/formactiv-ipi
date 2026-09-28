import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import { usePage } from '../../components/layout/ContextePage';
import {
  Alerte,
  AlerteErreur,
  Badge,
  Bouton,
  Carte,
  ChampSelection,
  Chargement,
  EnTetePage,
  EtatVide,
  Tableau,
  useNotifier,
} from '../../components/ui';
import { formaterNote, formaterPlageDates } from '../../utils/formatage';
import { clesSessions, sessionsApi } from '../sessions/api';
import {
  evaluationsApi,
  lireNote,
  noteValide,
  type FeuilleEvaluation,
  type NoteSaisie,
} from './evaluationsApi';

const cle = (inscriptionId: string, competenceId: string) => `${inscriptionId}:${competenceId}`;

/** Écran Figma 16 — Feuille d'évaluation d'une session (UC-08, US-16, US-17). */
export default function PageEvaluations() {
  usePage('Évaluations');
  const [parametres, setParametres] = useSearchParams();
  const sessionId = parametres.get('session') ?? '';

  const sessions = useQuery({
    queryKey: clesSessions.sessions({ limit: 100 }),
    queryFn: () => sessionsApi.lister({ limit: 100 }),
  });
  const commencees = (sessions.data?.donnees ?? []).filter((s) => s.statutTemporel !== 'A_VENIR');

  // Par défaut : la session commencée qui attend le plus de notes.
  useEffect(() => {
    if (sessionId || commencees.length === 0) return;
    const prioritaire = [...commencees].sort((a, b) => b.notesManquantes - a.notesManquantes)[0];
    setParametres({ session: prioritaire.id }, { replace: true });
  }, [sessionId, commencees, setParametres]);

  const feuille = useQuery({
    queryKey: ['feuille-evaluation', sessionId],
    queryFn: () => evaluationsApi.feuille(sessionId),
    enabled: sessionId !== '',
  });

  return (
    <>
      <EnTetePage
        titre={
          feuille.data ? `Évaluations - ${feuille.data.session.formation.intitule}` : 'Évaluations'
        }
        sousTitre={
          feuille.data &&
          `Session du ${formaterPlageDates(feuille.data.session.dateDebut, feuille.data.session.dateFin)} - seuil d’acquisition : ${formaterNote(feuille.data.session.formation.seuilAcquisition)}/20 (paramétrable par formation).`
        }
      />
      {sessions.isSuccess && commencees.length === 0 ? (
        <EtatVide titre="Aucune session à évaluer">
          <p>Les évaluations sont saisies à partir du début de vos sessions.</p>
        </EtatVide>
      ) : (
        <div className="filtres">
          <ChampSelection
            libelle="Session"
            value={sessionId}
            onChange={(e) => setParametres({ session: e.target.value })}
            options={commencees.map((s) => ({
              valeur: s.id,
              libelle: `${s.formation.intitule} — ${formaterPlageDates(s.dateDebut, s.dateFin)}${s.notesManquantes ? ` (${s.notesManquantes} à saisir)` : ''}`,
            }))}
          />
        </div>
      )}
      {feuille.error && <AlerteErreur erreur={feuille.error} />}
      {sessionId && feuille.isPending && <Chargement />}
      {feuille.data && <Feuille key={feuille.dataUpdatedAt} feuille={feuille.data} />}
    </>
  );
}

function Feuille({ feuille }: { feuille: FeuilleEvaluation }) {
  const client = useQueryClient();
  const notifier = useNotifier();
  const seuil = feuille.session.formation.seuilAcquisition;
  const [saisies, setSaisies] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      feuille.lignes.flatMap((l) =>
        feuille.competences.map((c) => [
          cle(l.inscriptionId, c.id),
          l.notes[c.id] ? String(l.notes[c.id]!.note).replace('.', ',') : '',
        ]),
      ),
    ),
  );
  const [soumis, setSoumis] = useState(false);

  const invalides = useMemo(
    () =>
      Object.entries(saisies)
        .filter(([, v]) => !noteValide(lireNote(v)))
        .map(([k]) => k),
    [saisies],
  );

  const enregistrer = useMutation({
    mutationFn: (notes: NoteSaisie[]) => evaluationsApi.enregistrer(feuille.session.id, notes),
    onSuccess: (maj) => {
      client.setQueryData(['feuille-evaluation', feuille.session.id], maj);
      void client.invalidateQueries({ queryKey: ['sessions'] });
      notifier.succes('Notes enregistrées.');
    },
  });

  const surEnvoi = (e: FormEvent) => {
    e.preventDefault();
    setSoumis(true);
    if (invalides.length > 0) return;
    const notes: NoteSaisie[] = [];
    for (const l of feuille.lignes) {
      for (const c of feuille.competences) {
        const note = lireNote(saisies[cle(l.inscriptionId, c.id)] ?? '');
        if (note !== null) notes.push({ inscriptionId: l.inscriptionId, competenceId: c.id, note });
      }
    }
    enregistrer.mutate(notes);
  };

  if (feuille.lignes.length === 0) {
    return (
      <Carte>
        <EtatVide titre="Aucun apprenant à évaluer">
          <p>Seules les inscriptions validées ou terminées apparaissent sur la feuille.</p>
        </EtatVide>
      </Carte>
    );
  }

  return (
    <Carte legende="Saisie des notes par compétence">
      <form onSubmit={surEnvoi} noValidate aria-label="Feuille d’évaluation">
        {!feuille.modifiable && (
          <Alerte type="info">
            <p>Consultation seule : la saisie est réservée au formateur affecté (RG-EVAL-01).</p>
          </Alerte>
        )}
        {soumis && invalides.length > 0 && (
          <Alerte type="erreur" titre="Certaines notes sont invalides">
            <p>
              {invalides.length} note{invalides.length > 1 ? 's' : ''} hors bornes : saisissez une
              valeur entre 0 et 20 (deux décimales au plus).
            </p>
          </Alerte>
        )}
        {enregistrer.error && <AlerteErreur erreur={enregistrer.error} />}
        <Tableau
          legende={`Notes de la session ${feuille.session.formation.intitule}`}
          legendeMasquee
          lignes={feuille.lignes}
          cleLigne={(l) => l.inscriptionId}
          colonnes={[
            {
              cle: 'apprenant',
              entete: 'Apprenant',
              enteteLigne: true,
              rendu: (l) => `${l.apprenant.prenom} ${l.apprenant.nom}`,
            },
            ...feuille.competences.map((c) => ({
              cle: c.id,
              entete: c.libelle,
              rendu: (l: FeuilleEvaluation['lignes'][number]) => {
                const k = cle(l.inscriptionId, c.id);
                const invalide = soumis && invalides.includes(k);
                return (
                  <input
                    className="champ__saisie"
                    inputMode="decimal"
                    value={saisies[k] ?? ''}
                    onChange={(e) => setSaisies({ ...saisies, [k]: e.target.value })}
                    aria-label={`Note de ${l.apprenant.prenom} ${l.apprenant.nom} — ${c.libelle}`}
                    aria-invalid={invalide || undefined}
                    disabled={!feuille.modifiable}
                  />
                );
              },
            })),
            {
              cle: 'acquises',
              entete: 'Compétences acquises',
              rendu: (l) => {
                const notes = feuille.competences.map((c) =>
                  lireNote(saisies[cle(l.inscriptionId, c.id)] ?? ''),
                );
                const acquises = notes.filter(
                  (n) => n !== null && Number.isFinite(n) && n >= seuil,
                ).length;
                const total = feuille.competences.length;
                return (
                  <Badge
                    variante={acquises === total ? 'succes' : acquises === 0 ? 'neutre' : 'alerte'}
                  >
                    {acquises} / {total}
                  </Badge>
                );
              },
            },
          ]}
        />
        {feuille.modifiable && (
          <div style={{ marginTop: 'var(--espace-4)' }}>
            <Bouton type="submit" chargement={enregistrer.isPending}>
              Enregistrer les notes
            </Bouton>
          </div>
        )}
        <p className="note">
          Toute correction conserve l’ancienne valeur au journal d’audit. Notes de 0 à 20.
        </p>
      </form>
    </Carte>
  );
}
