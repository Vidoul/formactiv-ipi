import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { sessionApi } from '../api/client';
import { FournisseurNotifications } from '../components/ui';
import { routes } from '../routes';
import { PAS_DE_SESSION, simulerApi } from '../test/api-simulee';
import { utilisateurTest } from '../test/rendu';
import { FournisseurAuth } from './ContexteAuth';

function demarrer(chemin: string) {
  const routeur = createMemoryRouter(routes, { initialEntries: [chemin] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <FournisseurNotifications>
        <FournisseurAuth>
          <RouterProvider router={routeur} />
        </FournisseurAuth>
      </FournisseurNotifications>
    </QueryClientProvider>,
  );
  return routeur;
}

const session = (surcharges = {}) => ({
  accessToken: 'jeton-acces',
  expireDans: 900,
  utilisateur: utilisateurTest(surcharges),
});

describe('Parcours de connexion (écran Figma 01, UC-01)', () => {
  beforeEach(() => sessionApi.definirJeton(null));

  it('redirige un visiteur non connecté vers la connexion', async () => {
    simulerApi({ 'POST /auth/refresh': PAS_DE_SESSION });
    const routeur = demarrer('/pilotage');
    expect(await screen.findByRole('heading', { name: 'FORMACTIV' })).toBeInTheDocument();
    expect(routeur.state.location.pathname).toBe('/connexion');
    // Titre posé par un effet de la page (chargée en différé) : il peut suivre le rendu du titre.
    await waitFor(() => expect(document.title).toBe('Connexion — FORMACTIV'));
  });

  it("affiche le message générique de l'API en cas d'échec", async () => {
    simulerApi({
      'POST /auth/refresh': PAS_DE_SESSION,
      'POST /auth/login': [
        401,
        { code: 'IDENTIFIANTS_INVALIDES', message: 'Adresse email ou mot de passe incorrect.' },
      ],
    });
    demarrer('/connexion');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText(/Adresse email/), 'lea.martin@mail.fr');
    await u.type(screen.getByLabelText(/Mot de passe/), 'mauvais');
    await u.click(screen.getByRole('button', { name: 'Se connecter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Adresse email ou mot de passe incorrect.',
    );
  });

  it('demande le code MFA puis ouvre l’espace du rôle', async () => {
    const { appels } = simulerApi({
      'POST /auth/refresh': PAS_DE_SESSION,
      'POST /auth/login': [200, { mfaRequis: true, jetonMfa: 'jeton-mfa' }],
      'POST /auth/mfa': [200, session()],
    });
    const routeur = demarrer('/connexion');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText(/Adresse email/), 'nadia.rey@formactiv.fr');
    await u.type(screen.getByLabelText(/Mot de passe/), 'Tr0mpette!Verte-Soir');
    await u.click(screen.getByRole('button', { name: 'Se connecter' }));

    const champCode = await screen.findByLabelText(/Code de vérification/);
    await waitFor(() => expect(champCode).toHaveFocus());
    expect(champCode).toHaveAttribute('autocomplete', 'one-time-code');
    await u.type(champCode, '123456');
    await u.click(screen.getByRole('button', { name: 'Vérifier le code' }));

    await waitFor(() => expect(routeur.state.location.pathname).toBe('/pilotage'));
    expect(appels.find((a) => a.cle === 'POST /auth/mfa')?.corps).toEqual({
      jetonMfa: 'jeton-mfa',
      code: '123456',
    });
    expect(sessionApi.obtenirJeton()).toBe('jeton-acces');
    // Tableau de bord du responsable formation (écran Figma 09).
    expect(
      await screen.findByRole('heading', { name: 'Pilotage des formations' }),
    ).toBeInTheDocument();
  });

  it('restaure la session existante au chargement (cookie de refresh)', async () => {
    simulerApi({ 'POST /auth/refresh': [200, session({ role: 'APPRENANT', prenom: 'Léa' })] });
    const routeur = demarrer('/');
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/mon-espace'));
    // Tableau de bord de l'apprenant (écran Figma 18).
    expect(await screen.findByRole('heading', { name: 'Bonjour Léa' })).toBeInTheDocument();
  });

  it('impose la configuration de la MFA obligatoire (RG-AUTH-03)', async () => {
    simulerApi({
      'POST /auth/refresh': [200, session({ mfaActive: false, mfaEnrolementRequis: true })],
    });
    const routeur = demarrer('/pilotage');
    await waitFor(() => expect(routeur.state.location.pathname).toBe('/mon-compte/securite'));
    expect(await screen.findByText('Double authentification obligatoire')).toBeInTheDocument();
  });

  it("refuse l'accès à un espace d'un autre rôle", async () => {
    simulerApi({ 'POST /auth/refresh': [200, session({ role: 'APPRENANT' })] });
    demarrer('/pilotage');
    expect(await screen.findByRole('heading', { name: 'Accès refusé' })).toBeInTheDocument();
  });
});

describe('Récupération du mot de passe (écran Figma 02, UC-02)', () => {
  it('affiche la confirmation neutre renvoyée par l’API', async () => {
    simulerApi({
      'POST /auth/refresh': PAS_DE_SESSION,
      'POST /auth/mot-de-passe-oublie': [
        202,
        { message: 'Si un compte existe pour cette adresse, un email a été envoyé.' },
      ],
    });
    demarrer('/mot-de-passe-oublie');
    const u = userEvent.setup();
    await u.type(await screen.findByLabelText(/Adresse email du compte/), 'lea.martin@mail.fr');
    await u.click(screen.getByRole('button', { name: 'Envoyer le lien de réinitialisation' }));
    expect(await screen.findByText(/Si un compte existe/)).toBeInTheDocument();
    expect(screen.getByText('Étape 2 sur 3 : email envoyé')).toBeInTheDocument();
  });

  it('contrôle la confirmation et restitue les critères de la politique', async () => {
    simulerApi({ 'POST /auth/refresh': PAS_DE_SESSION });
    demarrer('/reinitialisation?jeton=abc');
    const u = userEvent.setup();
    const champ = await screen.findByLabelText('Nouveau mot de passe (via le lien)', {
      exact: false,
    });
    await u.type(champ, 'Court1!');
    const criteres = screen.getAllByRole('listitem').map((li) => li.textContent);
    expect(criteres).toContain('✗ 12 caractères minimum : non respecté');
    expect(criteres).toContain('✓ un chiffre : respecté');
    await u.type(screen.getByLabelText(/Confirmer le mot de passe/), 'Autre');
    await u.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(screen.getByText('Les deux saisies ne correspondent pas.')).toBeInTheDocument();
  });
});

describe('Activation de compte (RG-RGPD-01)', () => {
  it('propose des consentements non pré-cochés et exige le consentement obligatoire', async () => {
    const { appels } = simulerApi({ 'POST /auth/refresh': PAS_DE_SESSION });
    demarrer('/activation?jeton=abc');
    const cases = await screen.findAllByRole('checkbox');
    expect(cases).toHaveLength(2);
    cases.forEach((c) => expect(c).not.toBeChecked());

    const u = userEvent.setup();
    await u.type(screen.getByLabelText(/Choisissez votre mot de passe/), 'Tr0mpette!Verte-Soir');
    await u.type(screen.getByLabelText(/Confirmer le mot de passe/), 'Tr0mpette!Verte-Soir');
    await u.click(screen.getByRole('button', { name: 'Activer mon compte' }));
    expect(await screen.findByText(/Ce consentement est nécessaire/)).toBeInTheDocument();
    expect(appels.some((a) => a.cle === 'POST /auth/activation')).toBe(false);
  });
});
