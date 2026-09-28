import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { simulerApi } from '../../test/api-simulee';
import { pageDe, rendre, utilisateurTest } from '../../test/rendu';
import PageUtilisateurs from './PageUtilisateurs';

const admin = utilisateurTest({ role: 'ADMIN', prenom: 'Alex', nom: 'Dupré' });
const oxalys = {
  id: 'e1',
  raisonSociale: 'Groupe Oxalys',
  siret: null,
  emailContact: 'a@b.fr',
  nombreComptes: 3,
  dateCreation: '',
};
const lea = {
  id: 'u1',
  nom: 'Martin',
  prenom: 'Léa',
  email: 'lea.martin@mail.fr',
  role: 'APPRENANT',
  statut: 'ACTIF',
  entreprise: { id: 'e1', raisonSociale: 'Groupe Oxalys' },
};

describe('Écran Figma 06 — Utilisateurs (UC-03)', () => {
  it('liste les comptes avec des statuts libellés et ouvre la fiche', async () => {
    simulerApi({
      'GET /utilisateurs': [200, pageDe([lea])],
      'GET /entreprises': [200, pageDe([oxalys])],
      'GET /utilisateurs/u1': [
        200,
        {
          ...lea,
          mfaActive: false,
          active: true,
          verrouilleJusquA: null,
          dateDerniereConnexion: null,
          dateCreation: '2026-01-01T10:00:00Z',
        },
      ],
    });
    rendre(<PageUtilisateurs />, { utilisateur: admin, route: '/admin/utilisateurs' });

    const tableau = await screen.findByRole('table', { name: /Comptes utilisateurs/ });
    const ligne = within(tableau).getByRole('row', { name: /Martin Léa/ });
    expect(within(ligne).getByText('Actif')).toBeInTheDocument();

    await userEvent.click(
      within(ligne).getByRole('button', { name: /Ouvrir la fiche de Léa Martin/ }),
    );
    const fiche = await screen.findByRole('form', { name: 'Fiche du compte' });
    expect(within(fiche).getByLabelText(/^Email/)).toHaveValue('lea.martin@mail.fr');
    expect(within(fiche).getByLabelText(/^Entreprise/)).toHaveValue('e1');
  });

  it('crée un compte et affiche les erreurs de validation de l’API par champ', async () => {
    const { appels } = simulerApi({
      'GET /utilisateurs': [200, pageDe([])],
      'GET /entreprises': [200, pageDe([oxalys])],
      'POST /utilisateurs': [
        409,
        {
          statusCode: 409,
          code: 'EMAIL_DEJA_UTILISE',
          message: 'Cette adresse email est déjà utilisée.',
          details: [{ champ: 'email', messages: ['Cette adresse email est déjà utilisée.'] }],
        },
      ],
    });
    rendre(<PageUtilisateurs />, { utilisateur: admin, route: '/admin/utilisateurs' });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Créer un compte' }));

    const formulaire = await screen.findByRole('form', { name: 'Nouveau compte' });
    await u.type(within(formulaire).getByLabelText(/^Nom/), 'Morel');
    await u.type(within(formulaire).getByLabelText(/^Prénom/), 'Théo');
    await u.type(within(formulaire).getByLabelText(/^Email/), 't.morel@oxalys.fr');
    await u.selectOptions(within(formulaire).getByLabelText(/^Rôle/), 'CLIENT_ENTREPRISE');
    await u.selectOptions(within(formulaire).getByLabelText(/^Entreprise/), 'e1');
    await u.click(within(formulaire).getByRole('button', { name: 'Créer le compte' }));

    await waitFor(() =>
      expect(within(formulaire).getByLabelText(/^Email/)).toHaveAccessibleDescription(
        'Cette adresse email est déjà utilisée.',
      ),
    );
    expect(appels.find((a) => a.cle === 'POST /utilisateurs')?.corps).toEqual({
      nom: 'Morel',
      prenom: 'Théo',
      email: 't.morel@oxalys.fr',
      role: 'CLIENT_ENTREPRISE',
      entrepriseId: 'e1',
    });
  });

  it('ne propose pas le rôle Administrateur au responsable formation', async () => {
    simulerApi({ 'GET /utilisateurs': [200, pageDe([])], 'GET /entreprises': [200, pageDe([])] });
    rendre(<PageUtilisateurs />, {
      utilisateur: utilisateurTest(),
      route: '/admin/utilisateurs?creation=1',
    });
    const formulaire = await screen.findByRole('form', { name: 'Nouveau compte' });
    const options = within(within(formulaire).getByLabelText(/^Rôle/)).getAllByRole('option');
    expect(options.map((o) => o.textContent)).not.toContain('Administrateur');
  });
});
