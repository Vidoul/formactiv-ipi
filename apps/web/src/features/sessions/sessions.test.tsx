import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { simulerApi } from '../../test/api-simulee';
import { pageDe, rendre, utilisateurTest } from '../../test/rendu';
import PageInscriptions from './PageInscriptions';
import PagePlanificationSession from './PagePlanificationSession';

const resp = utilisateurTest();
const formation = {
  id: 'f1',
  intitule: 'Cybersécurité fondamentaux',
  dureeHeures: 35,
  modalite: 'HYBRIDE',
  prerequis: 'Bases en informatique',
  statut: 'PUBLIEE',
  seuilAcquisition: 10,
  nombreCompetences: 3,
  nombreSessions: 1,
};
const session = {
  id: 's1',
  formation: {
    id: 'f1',
    intitule: 'Cybersécurité fondamentaux',
    modalite: 'HYBRIDE',
    statut: 'PUBLIEE',
  },
  dateDebut: '2026-09-14',
  dateFin: '2026-09-18',
  lieu: 'Toulouse',
  capaciteMax: 12,
  statutTemporel: 'A_VENIR',
  nombreInscrits: 9,
  placesOccupees: 9,
  formateurs: [],
  alerteSansFormateur: false,
  notesManquantes: 0,
};

describe('Écran Figma 12 — planifier une session (UC-05)', () => {
  it('signale le conflit d’agenda et transmet les formateurs choisis', async () => {
    const { appels } = simulerApi({
      'GET /formations': [200, pageDe([formation])],
      'GET /formateurs/disponibilites': [
        200,
        [
          { id: 'k', nom: 'Selle', prenom: 'Karim', conflits: [] },
          {
            id: 's',
            nom: 'Vidal',
            prenom: 'Sonia',
            conflits: [
              { sessionId: 'x', formation: 'RGPD en pratique', premierJour: '2026-09-15' },
            ],
          },
        ],
      ],
      'POST /sessions': [201, { ...session, id: 's2' }],
    });
    rendre(
      <Routes>
        <Route path="/sessions/nouvelle" element={<PagePlanificationSession />} />
        <Route path="/sessions/:id" element={<p>Session créée</p>} />
      </Routes>,
      { utilisateur: resp, route: '/sessions/nouvelle' },
    );
    const u = userEvent.setup();
    const parametres = await screen.findByRole('form', { name: 'Paramètres de la session' });
    await waitFor(() =>
      expect(within(parametres).getByRole('option', { name: /Cybersécurité/ })).toBeInTheDocument(),
    );
    await u.selectOptions(within(parametres).getByLabelText(/^Formation/), 'f1');
    await u.type(within(parametres).getByLabelText(/^Date de début/), '2026-09-14');
    await u.type(within(parametres).getByLabelText(/^Date de fin/), '2026-09-18');
    await u.type(within(parametres).getByLabelText(/Capacité maximale/), '12');

    await u.click(screen.getByRole('button', { name: 'Affecter un formateur' }));
    const dialogue = await screen.findByRole('dialog', { name: 'Affecter un formateur' });
    await waitFor(() =>
      expect(
        within(dialogue).getByRole('option', { name: /Sonia Vidal — conflit/ }),
      ).toBeInTheDocument(),
    );
    await u.selectOptions(within(dialogue).getByLabelText('Formateur'), 's');
    await u.click(within(dialogue).getByRole('button', { name: 'Affecter' }));

    const formateurs = screen.getByRole('table', { name: 'Formateurs de la session' });
    expect(within(formateurs).getByText(/Conflit le 15\/09/)).toBeInTheDocument();

    await u.click(within(parametres).getByRole('button', { name: 'Créer la session' }));
    expect(await screen.findByText('Session créée')).toBeInTheDocument();
    expect(appels.find((a) => a.cle === 'POST /sessions')?.corps).toEqual({
      formationId: 'f1',
      dateDebut: '2026-09-14',
      dateFin: '2026-09-18',
      capaciteMax: 12,
      lieu: '',
      formateurIds: ['s'],
    });
  });
});

describe('Écran Figma 13 — suivi des inscriptions (UC-06)', () => {
  it('demande la confirmation des prérequis avant la validation (RG-INSC-03)', async () => {
    const inscription = {
      id: 'i1',
      statut: 'EN_ATTENTE',
      dateInscription: '2026-07-05T10:00:00Z',
      prerequisRequis: true,
      prerequisVerifies: false,
      apprenant: { id: 'a1', nom: 'Blanc', prenom: 'Sami', entreprise: null },
      session: {
        id: 's1',
        dateDebut: '2026-09-14',
        dateFin: '2026-09-18',
        lieu: null,
        formation: { id: 'f1', intitule: 'Cybersécurité fondamentaux' },
      },
    };
    const { appels } = simulerApi({
      'GET /sessions': [200, pageDe([session])],
      'GET /entreprises': [200, pageDe([])],
      'GET /inscriptions': [200, pageDe([inscription])],
      'PATCH /inscriptions/i1': [
        200,
        { ...inscription, statut: 'VALIDEE', prerequisVerifies: true },
      ],
    });
    rendre(<PageInscriptions />, { utilisateur: resp, route: '/inscriptions?session=s1' });

    expect(
      await screen.findByText(
        /Cybersécurité fondamentaux - 14 au 18\/09\/2026 - 9 inscrits \/ 12 places/,
      ),
    ).toBeInTheDocument();
    const ligne = await screen.findByRole('row', { name: /Sami Blanc/ });
    expect(within(ligne).getByText('À vérifier')).toBeInTheDocument();

    const u = userEvent.setup();
    await u.click(within(ligne).getByRole('button', { name: /Valider/ }));
    const dialogue = await screen.findByRole('dialog', { name: 'Prérequis à vérifier' });
    await u.click(within(dialogue).getByRole('button', { name: /Prérequis vérifiés/ }));
    await waitFor(() =>
      expect(appels.find((a) => a.cle === 'PATCH /inscriptions/i1')?.corps).toEqual({
        statut: 'VALIDEE',
        prerequisVerifies: true,
      }),
    );
  });
});
