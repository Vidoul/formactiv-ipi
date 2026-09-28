import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulerApi } from '../../test/api-simulee';
import { pageDe, rendre, utilisateurTest } from '../../test/rendu';
import PageCompetences from './PageCompetences';
import PageFormations from './PageFormations';

const resp = utilisateurTest();
const securiser = {
  id: 'c1',
  libelle: "Sécuriser un système d'information",
  typeReferentiel: 'RNCP',
  codeRncp: 'RNCP36125-C2',
  nombreFormations: 1,
};
const phishing = {
  id: 'c2',
  libelle: 'Sensibilisation phishing',
  typeReferentiel: 'INTERNE',
  codeRncp: null,
  nombreFormations: 0,
};
const brouillon = {
  id: 'f1',
  intitule: "Management d'équipe IT",
  dureeHeures: 21,
  modalite: 'PRESENTIEL',
  prerequis: 'Aucun',
  statut: 'BROUILLON',
  seuilAcquisition: 10,
  nombreCompetences: 0,
  nombreSessions: 0,
};

describe('Écran Figma 10 — catalogue et fiche formation (UC-04)', () => {
  it('crée une formation avec les compétences choisies avant enregistrement', async () => {
    const { appels } = simulerApi({
      'GET /formations': [200, pageDe([])],
      'GET /competences': [200, pageDe([securiser, phishing])],
      'POST /formations': [201, { ...brouillon, id: 'f2', competences: [securiser] }],
      'GET /formations/f2': [201, { ...brouillon, id: 'f2', competences: [securiser] }],
    });
    rendre(<PageFormations />, { utilisateur: resp, route: '/formations?creation=1' });
    const u = userEvent.setup();
    const formulaire = await screen.findByRole('form', { name: 'Nouvelle formation' });

    await u.type(within(formulaire).getByLabelText(/^Intitulé/), 'Cybersécurité');
    await u.type(within(formulaire).getByLabelText(/^Durée/), '35');
    await u.selectOptions(within(formulaire).getByLabelText(/^Modalité/), 'HYBRIDE');
    await waitFor(() =>
      expect(within(formulaire).getByRole('option', { name: /Sécuriser/ })).toBeInTheDocument(),
    );
    await u.selectOptions(within(formulaire).getByLabelText('Ajouter une compétence'), 'c1');
    await u.click(within(formulaire).getByRole('button', { name: 'Ajouter' }));
    expect(
      within(formulaire).getByRole('button', { name: /Retirer la compétence Sécuriser/ }),
    ).toBeInTheDocument();

    await u.click(within(formulaire).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(appels.find((a) => a.cle === 'POST /formations')?.corps).toMatchObject({
        intitule: 'Cybersécurité',
        dureeHeures: 35,
        modalite: 'HYBRIDE',
        competenceIds: ['c1'],
      }),
    );
  });

  it('restitue le refus de publication sans compétence (RG-FORM-02)', async () => {
    simulerApi({
      'GET /formations': [200, pageDe([brouillon])],
      'GET /competences': [200, pageDe([securiser])],
      'GET /formations/f1': [200, { ...brouillon, competences: [] }],
      'PATCH /formations/f1': [
        409,
        {
          code: 'TRANSITION_STATUT_INVALIDE',
          message:
            'Une formation doit viser au moins une compétence pour être publiée (RG-FORM-02).',
        },
      ],
    });
    rendre(<PageFormations />, { utilisateur: resp, route: '/formations?formation=f1' });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Publier' }));
    expect(
      await screen.findByText(/au moins une compétence pour être publiée/),
    ).toBeInTheDocument();
    expect(screen.getByText('Brouillon')).toBeInTheDocument();
  });
});

describe('Écran Figma 11 — référentiels de compétences (RG-COMP-01)', () => {
  it('affiche le référentiel en toutes lettres et exige le code RNCP', async () => {
    simulerApi({ 'GET /competences': [200, pageDe([securiser, phishing])] });
    rendre(<PageCompetences />, { utilisateur: resp, route: '/competences' });
    const tableau = await screen.findByRole('table', { name: 'Compétences des référentiels' });
    const ligne = within(tableau).getByRole('row', { name: /Sécuriser/ });
    expect(within(ligne).getByText('RNCP')).toBeInTheDocument();
    expect(within(ligne).getByText('RNCP36125-C2')).toBeInTheDocument();

    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Créer une compétence interne' }));
    const dialogue = await screen.findByRole('dialog', { name: 'Nouvelle compétence' });
    expect(within(dialogue).queryByLabelText(/Code RNCP/)).not.toBeInTheDocument();
    await u.selectOptions(within(dialogue).getByLabelText(/^Référentiel/), 'RNCP');
    expect(within(dialogue).getByLabelText(/Code RNCP/)).toBeRequired();
  });
});
