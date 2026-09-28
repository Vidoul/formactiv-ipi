import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach } from 'vitest';
import { simulerApi } from '../../test/api-simulee';
import { pageDe, rendre, reponseJson, utilisateurTest } from '../../test/rendu';
import type { DemandeAdministration, MesDonnees } from './api';
import PageDemandesRgpd from './PageDemandesRgpd';
import PageJournal, { horodatageUtc } from './PageJournal';
import PageMesDonnees from './PageMesDonnees';

const lea = utilisateurTest({ id: 'a1', role: 'APPRENANT', prenom: 'Léa', nom: 'Martin' });
const admin = utilisateurTest({ role: 'ADMIN', prenom: 'Alex', nom: 'Dupré' });

const donnees = (surcharges: Partial<MesDonnees> = {}): MesDonnees => ({
  compte: {
    id: 'a1',
    nom: 'Martin',
    prenom: 'Léa',
    email: 'lea.martin@mail.fr',
    role: 'APPRENANT',
    statutCompte: 'ACTIF',
    entreprise: { raisonSociale: 'Groupe Oxalys' },
    mfaActive: false,
    dateCreation: '2026-01-12T09:00:00Z',
    dateDerniereConnexion: '2026-07-27T16:42:00Z',
  },
  consentements: [
    {
      id: 'c1',
      finalite: 'GESTION_COMPTE',
      versionMentions: 'v2.1',
      dateConsentement: '2026-01-12T09:00:00Z',
      dateRetrait: null,
    },
    {
      id: 'c2',
      finalite: 'QUESTIONNAIRES_SATISFACTION',
      versionMentions: 'v2.1',
      dateConsentement: '2026-01-12T09:00:00Z',
      dateRetrait: null,
    },
  ],
  inscriptions: [
    { formation: 'Cyber', dateDebut: '2026-09-14', dateFin: '2026-09-18', statut: 'TERMINEE' },
  ],
  evaluations: [],
  documents: [],
  satisfaction: [],
  demandes: [],
  ...surcharges,
});

let clics: HTMLAnchorElement[];
beforeEach(() => {
  clics = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clics.push(this);
  });
  URL.createObjectURL = vi.fn(() => 'blob:formactiv');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('Écran Figma 04 — mes données personnelles (UC-13)', () => {
  it('présente les données du compte et l’historique des consentements', async () => {
    simulerApi({ 'GET /rgpd/mes-donnees': [200, donnees()] });
    rendre(<PageMesDonnees />, { utilisateur: lea, route: '/rgpd/mes-donnees' });
    expect(await screen.findByText('Martin Léa')).toBeInTheDocument();
    expect(screen.getByText('Groupe Oxalys')).toBeInTheDocument();
    expect(screen.getByText('1 inscription, 0 note, 0 document, 0 avis')).toBeInTheDocument();
    const consentements = screen.getByRole('table', { name: 'Historique des consentements' });
    expect(
      within(consentements).getByRole('row', {
        name: /Questionnaires de satisfaction v2.1 12\/01\/2026 Donné/,
      }),
    ).toBeInTheDocument();
  });

  it('retire le consentement facultatif et télécharge l’export', async () => {
    const { appels } = simulerApi({
      'GET /rgpd/mes-donnees': [200, donnees()],
      'DELETE /rgpd/consentements/QUESTIONNAIRES_SATISFACTION': [200, donnees()],
      'GET /rgpd/mes-donnees/export': () =>
        new Response('{}', {
          headers: { 'Content-Disposition': 'attachment; filename="formactiv-mes-donnees.json"' },
        }),
    });
    rendre(<PageMesDonnees />, { utilisateur: lea, route: '/rgpd/mes-donnees' });
    const u = userEvent.setup();
    await u.click(
      await screen.findByRole('button', {
        name: 'Retirer mon accord aux questionnaires de satisfaction',
      }),
    );
    await waitFor(() =>
      expect(
        appels.some((a) => a.cle === 'DELETE /rgpd/consentements/QUESTIONNAIRES_SATISFACTION'),
      ).toBe(true),
    );
    await u.click(screen.getByRole('button', { name: 'Télécharger mes données' }));
    await waitFor(() => expect(clics).toHaveLength(1));
    expect(clics[0].download).toBe('formactiv-mes-donnees.json');
  });

  it('corrige le nom en libre-service', async () => {
    const corrige = donnees();
    corrige.compte.nom = 'Martin-Roux';
    const { appels } = simulerApi({
      'GET /rgpd/mes-donnees': [200, donnees()],
      'PATCH /rgpd/mes-donnees': [200, corrige],
    });
    rendre(<PageMesDonnees />, { utilisateur: lea, route: '/rgpd/mes-donnees' });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Corriger mes informations' }));
    const dialogue = screen.getByRole('dialog', { name: 'Corriger mes informations' });
    const nom = within(dialogue).getByLabelText(/^Nom/);
    await u.clear(nom);
    await u.type(nom, 'Martin-Roux');
    await u.click(within(dialogue).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() =>
      expect(appels.find((a) => a.cle === 'PATCH /rgpd/mes-donnees')?.corps).toEqual({
        nom: 'Martin-Roux',
        prenom: 'Léa',
      }),
    );
    expect(await screen.findByText('Martin-Roux Léa')).toBeInTheDocument();
  });

  it('dépose une demande de suppression après avertissement', async () => {
    const { appels } = simulerApi({
      'GET /rgpd/mes-donnees': [200, donnees()],
      'POST /rgpd/demandes': [
        201,
        { id: 'd1', numero: 'D-127', type: 'SUPPRESSION', statut: 'RECUE' },
      ],
    });
    rendre(<PageMesDonnees />, { utilisateur: lea, route: '/rgpd/mes-donnees' });
    const u = userEvent.setup();
    await u.click(
      await screen.findByRole('button', { name: 'Demander la suppression de mon compte' }),
    );
    const dialogue = screen.getByRole('dialog', { name: 'Demander la suppression de mon compte' });
    expect(within(dialogue).getByText(/Cette action est irréversible/)).toBeInTheDocument();
    await u.type(within(dialogue).getByLabelText('Motif (facultatif)'), 'Départ');
    await u.click(
      within(dialogue).getByRole('button', { name: 'Confirmer la demande de suppression' }),
    );
    await waitFor(() =>
      expect(appels.find((a) => a.cle === 'POST /rgpd/demandes')?.corps).toEqual({
        type: 'SUPPRESSION',
        message: 'Départ',
      }),
    );
    expect(
      await screen.findByText('Votre demande D-127 a été transmise à l’administration.'),
    ).toBeInTheDocument();
  });

  it('signale une suppression déjà en cours au lieu de proposer une nouvelle demande', async () => {
    simulerApi({
      'GET /rgpd/mes-donnees': [
        200,
        donnees({
          demandes: [
            {
              id: 'd1',
              numero: 'D-126',
              type: 'SUPPRESSION',
              statut: 'EN_COURS',
              message: null,
              reponse: null,
              dateDemande: '2026-07-25T10:00:00Z',
              dateTraitement: null,
            },
          ],
        }),
      ],
    });
    rendre(<PageMesDonnees />, { utilisateur: lea, route: '/rgpd/mes-donnees' });
    expect(
      await screen.findByText(/Votre demande D-126 est en cours de traitement/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Demander la suppression de mon compte' }),
    ).not.toBeInTheDocument();
  });
});

describe('Écran Figma 07 — file des demandes RGPD (UC-14)', () => {
  const demande = (surcharges: Partial<DemandeAdministration>): DemandeAdministration => ({
    id: 'd1',
    numero: 'D-126',
    type: 'ACCES',
    statut: 'RECUE',
    message: null,
    reponse: null,
    dateDemande: '2026-07-26T10:00:00Z',
    dateTraitement: null,
    demandeur: {
      id: 'a1',
      nom: 'Martin',
      prenom: 'Léa',
      email: 'lea.martin@mail.fr',
      statutCompte: 'ACTIF',
    },
    traitant: null,
    ...surcharges,
  });

  it('affiche la file ouverte et avertit avant l’effacement d’un compte', async () => {
    const requetes: URLSearchParams[] = [];
    const { appels } = simulerApi({
      'GET /rgpd/demandes': (_c, url) => {
        requetes.push(url.searchParams);
        return reponseJson(
          200,
          pageDe([
            demande({
              id: 'd2',
              numero: 'D-125',
              type: 'SUPPRESSION',
              statut: 'EN_COURS',
              message: 'Départ',
            }),
            demande({
              id: 'd4',
              numero: 'D-123',
              statut: 'TRAITEE',
              dateTraitement: '2026-07-22T10:00:00Z',
            }),
          ]),
        );
      },
      'PATCH /rgpd/demandes/d2': [
        200,
        demande({ id: 'd2', numero: 'D-125', type: 'SUPPRESSION', statut: 'TRAITEE' }),
      ],
    });
    rendre(<PageDemandesRgpd />, { utilisateur: admin, route: '/admin/rgpd' });

    const ligne = await screen.findByRole('row', { name: /D-125/ });
    expect(within(ligne).getByText('Suppression')).toBeInTheDocument();
    expect(screen.getByText('Clôturée le 22/07')).toBeInTheDocument();
    expect(requetes[0].get('statut')).toBe('OUVERTES');

    const u = userEvent.setup();
    await u.click(within(ligne).getByRole('button', { name: 'Continuer la demande D-125' }));
    const dialogue = screen.getByRole('dialog', { name: 'Demande D-125 — Suppression' });
    expect(within(dialogue).getByText('Départ')).toBeInTheDocument();
    expect(within(dialogue).getByText('Action irréversible')).toBeInTheDocument();
    await u.click(within(dialogue).getByRole('button', { name: 'Effacer le compte et clôturer' }));
    await waitFor(() =>
      expect(appels.find((a) => a.cle === 'PATCH /rgpd/demandes/d2')?.corps).toEqual({
        statut: 'TRAITEE',
      }),
    );
  });

  it('exige le motif d’un refus avant tout appel', async () => {
    const { appels } = simulerApi({ 'GET /rgpd/demandes': [200, pageDe([demande({})])] });
    rendre(<PageDemandesRgpd />, { utilisateur: admin, route: '/admin/rgpd' });
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Traiter la demande D-126' }));
    const dialogue = screen.getByRole('dialog');
    await u.selectOptions(within(dialogue).getByLabelText('Décision'), 'REFUSEE');
    await u.click(within(dialogue).getByRole('button', { name: 'Enregistrer la décision' }));
    expect(within(dialogue).getByText('Un refus doit être motivé.')).toBeInTheDocument();
    expect(appels.some((a) => a.cle.startsWith('PATCH'))).toBe(false);
  });
});

describe('Écran Figma 08 — journal d’audit (UC-15)', () => {
  it('présente les entrées et transmet les filtres', async () => {
    const requetes: URLSearchParams[] = [];
    simulerApi({
      'GET /journal': (_c, url) => {
        requetes.push(url.searchParams);
        return reponseJson(200, {
          ...pageDe([
            {
              id: 'j1',
              date: '2026-07-28T07:12:04.000Z',
              utilisateur: {
                id: 'u1',
                prenom: 'Alex',
                nom: 'Dupré',
                email: 'a.dupre@formactiv.fr',
              },
              action: 'CHANGEMENT_ROLE',
              typeObjet: 'utilisateur',
              idObjet: '8f21aa00-0000-0000-0000-000000000000',
              details: 'APPRENANT vers FORMATEUR',
              adresseIp: '127.0.0.1',
            },
            {
              id: 'j2',
              date: '2026-07-27T15:02:33.000Z',
              utilisateur: null,
              action: 'VERROUILLAGE_COMPTE',
              typeObjet: 'utilisateur',
              idObjet: null,
              details: '5 échecs de connexion',
              adresseIp: null,
            },
          ]),
          total: 452,
          limit: 50,
        });
      },
    });
    rendre(<PageJournal />, { utilisateur: admin, route: '/admin/journal' });
    const tableau = await screen.findByRole('table', {
      name: 'Journal d’audit (452 entrées sur la période)',
    });
    expect(
      within(tableau).getByRole('row', {
        name: /2026-07-28 07:12:04 Alex Dupré Changement de rôle CHANGEMENT_ROLE utilisateur 8f21aa00/,
      }),
    ).toBeInTheDocument();
    expect(within(tableau).getByText('système')).toBeInTheDocument();

    const u = userEvent.setup();
    await u.type(screen.getByLabelText(/^Utilisateur/), 'dupré');
    await u.selectOptions(screen.getByLabelText('Action'), 'EXPORT_CSV');
    await u.selectOptions(screen.getByLabelText('Période'), '90');
    await u.click(screen.getByRole('button', { name: 'Appliquer' }));
    await waitFor(() =>
      expect(Object.fromEntries(requetes.at(-1)!)).toMatchObject({
        utilisateur: 'dupré',
        action: 'EXPORT_CSV',
        jours: '90',
      }),
    );
  });

  it('formate l’horodatage UTC', () => {
    expect(horodatageUtc('2026-07-28T07:12:04.123Z')).toBe('2026-07-28 07:12:04');
  });
});
