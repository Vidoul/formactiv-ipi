import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulerApi } from '../../test/api-simulee';
import { pageDe, rendre, utilisateurTest } from '../../test/rendu';
import PageEvaluations from './PageEvaluations';

const formateur = utilisateurTest({ role: 'FORMATEUR', prenom: 'Karim', nom: 'Selle' });
const feuille = {
  session: {
    id: 's1',
    dateDebut: '2026-09-14',
    dateFin: '2026-09-18',
    formation: { id: 'f1', intitule: 'Cybersécurité fondamentaux', seuilAcquisition: 10 },
  },
  competences: [
    { id: 'c1', libelle: 'Sécuriser un SI', typeReferentiel: 'RNCP' },
    { id: 'c2', libelle: 'Analyser les risques', typeReferentiel: 'RNCP' },
  ],
  lignes: [
    {
      inscriptionId: 'i1',
      statut: 'VALIDEE',
      apprenant: { id: 'a1', nom: 'Martin', prenom: 'Léa' },
      notes: { c1: { evaluationId: 'e1', note: 15, acquise: true }, c2: null },
      acquises: 1,
      total: 2,
    },
  ],
  modifiable: true,
};

describe('Écran Figma 16 — feuille d’évaluation (UC-08)', () => {
  it('met à jour la synthèse en direct et enregistre les notes saisies', async () => {
    const { appels } = simulerApi({
      'GET /sessions': [200, pageDe([])],
      'GET /sessions/s1/feuille-evaluation': [200, feuille],
      'PUT /sessions/s1/feuille-evaluation': [200, feuille],
    });
    rendre(<PageEvaluations />, {
      utilisateur: formateur,
      route: '/formateur/evaluations?session=s1',
    });

    expect(
      await screen.findByRole('heading', { name: 'Évaluations - Cybersécurité fondamentaux' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/seuil d’acquisition : 10\/20/)).toBeInTheDocument();

    const ligne = screen.getByRole('row', { name: /Léa Martin/ });
    expect(within(ligne).getByText('1 / 2')).toBeInTheDocument();
    const champ = within(ligne).getByRole('textbox', {
      name: 'Note de Léa Martin — Analyser les risques',
    });
    const u = userEvent.setup();
    await u.type(champ, '12,5');
    expect(within(ligne).getByText('2 / 2')).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Enregistrer les notes' }));
    await waitFor(() =>
      expect(appels.find((a) => a.cle === 'PUT /sessions/s1/feuille-evaluation')?.corps).toEqual({
        notes: [
          { inscriptionId: 'i1', competenceId: 'c1', note: 15 },
          { inscriptionId: 'i1', competenceId: 'c2', note: 12.5 },
        ],
      }),
    );
  });

  it('bloque l’envoi d’une note hors bornes et signale le champ', async () => {
    const { appels } = simulerApi({
      'GET /sessions': [200, pageDe([])],
      'GET /sessions/s1/feuille-evaluation': [200, feuille],
    });
    rendre(<PageEvaluations />, {
      utilisateur: formateur,
      route: '/formateur/evaluations?session=s1',
    });
    const champ = await screen.findByRole('textbox', {
      name: 'Note de Léa Martin — Analyser les risques',
    });
    const u = userEvent.setup();
    await u.type(champ, '25');
    await u.click(screen.getByRole('button', { name: 'Enregistrer les notes' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Certaines notes sont invalides');
    expect(champ).toHaveAttribute('aria-invalid', 'true');
    expect(appels.some((a) => a.cle.startsWith('PUT'))).toBe(false);
  });
});
