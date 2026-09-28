import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach } from 'vitest';
import { simulerApi } from '../../test/api-simulee';
import { pageDe, rendre, reponseJson, utilisateurTest } from '../../test/rendu';
import PageDocumentsSession from './PageDocumentsSession';
import PageExports from './PageExports';
import PageMesDocuments from './PageMesDocuments';
import PageParcours, { libelleMoyenne } from './PageParcours';

const resp = utilisateurTest();
const lea = utilisateurTest({
  id: 'a1',
  role: 'APPRENANT',
  prenom: 'Léa',
  nom: 'Martin',
  email: 'lea.martin@mail.fr',
});
const client = utilisateurTest({
  id: 'c1',
  role: 'CLIENT_ENTREPRISE',
  prenom: 'Théo',
  nom: 'Morel',
});

const session = {
  id: 's1',
  formation: {
    id: 'f1',
    intitule: 'Cybersécurité fondamentaux',
    modalite: 'PRESENTIEL',
    statut: 'PUBLIEE',
  },
  dateDebut: '2026-09-14',
  dateFin: '2026-09-18',
  lieu: 'Toulouse',
  capaciteMax: 12,
  statutTemporel: 'TERMINEE',
  nombreInscrits: 3,
  placesOccupees: 3,
  formateurs: [],
  alerteSansFormateur: false,
  notesManquantes: 0,
};

const ligne = (
  inscriptionId: string,
  prenom: string,
  nom: string,
  acquises: number,
  documentPropose: 'CERTIFICAT' | 'ATTESTATION',
  documents: unknown[] = [],
) => ({
  inscriptionId,
  statut: 'TERMINEE',
  apprenant: { id: `a-${inscriptionId}`, prenom, nom },
  competencesAcquises: acquises,
  competencesVisees: 4,
  typesGenerables:
    documentPropose === 'CERTIFICAT' ? ['CERTIFICAT', 'ATTESTATION'] : ['ATTESTATION'],
  documentPropose,
  documents,
});

const bilan = (peutGenerer = true) => ({
  session: {
    id: 's1',
    dateDebut: '2026-09-14',
    dateFin: '2026-09-18',
    terminee: true,
    formation: { id: 'f1', intitule: 'Cybersécurité fondamentaux' },
  },
  peutGenerer,
  lignes: [
    ligne('i1', 'Léa', 'Martin', 4, 'CERTIFICAT'),
    ligne('i2', 'Paul', 'Girard', 3, 'ATTESTATION'),
    ligne('i3', 'Sami', 'Blanc', 4, 'CERTIFICAT', [
      {
        id: 'd3',
        type: 'CERTIFICAT',
        reference: 'C-2026-0412',
        dateGeneration: '2026-09-19T08:00:00Z',
      },
    ]),
  ],
});

const documentGenere = {
  id: 'd1',
  type: 'CERTIFICAT',
  reference: 'C-2026-0413',
  dateGeneration: '2026-09-28T10:00:00Z',
  inscriptionId: 'i1',
  apprenant: { id: 'a1', prenom: 'Léa', nom: 'Martin' },
  formation: { id: 'f1', intitule: 'Cybersécurité fondamentaux' },
  session: { id: 's1', dateDebut: '2026-09-14', dateFin: '2026-09-18' },
  emetteur: { prenom: 'Nadia', nom: 'Rey' },
};

/** Les téléchargements passent par un lien <a download> : on intercepte le clic. */
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

const fichier = (nom: string) =>
  new Response('contenu', {
    status: 200,
    headers: { 'Content-Disposition': `attachment; filename="${nom}"` },
  });

describe('Écran Figma 14 — génération des documents (UC-09)', () => {
  it('propose le bon document par apprenant et génère un certificat', async () => {
    const { appels } = simulerApi({
      'GET /sessions': [200, pageDe([session])],
      'GET /sessions/s1/documents': [200, bilan()],
      'POST /inscriptions/i1/documents': [201, documentGenere],
    });
    rendre(<PageDocumentsSession />, { utilisateur: resp, route: '/documents?session=s1' });

    expect(
      await screen.findByText('Session : Cybersécurité fondamentaux - terminée le 18/09/2026'),
    ).toBeInTheDocument();
    const lignePaul = screen.getByRole('row', { name: /Paul Girard/ });
    expect(within(lignePaul).getByText('3 / 4')).toBeInTheDocument();
    expect(within(lignePaul).getByText('Attestation')).toBeInTheDocument();
    expect(
      within(lignePaul).getByRole('button', { name: 'Générer l’attestation de Paul Girard' }),
    ).toBeInTheDocument();
    const ligneSami = screen.getByRole('row', { name: /Sami Blanc/ });
    expect(within(ligneSami).getByText(/C-2026-0412 généré le 19\/09/)).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Générer le certificat de Léa Martin' }),
    );
    await waitFor(() =>
      expect(appels.find((a) => a.cle === 'POST /inscriptions/i1/documents')?.corps).toEqual({
        type: 'CERTIFICAT',
      }),
    );
    expect(
      await screen.findByText('Certificat C-2026-0413 généré pour Léa Martin.'),
    ).toBeInTheDocument();
  });

  it('exporte la session en PDF dans la portée du rôle', async () => {
    let requete: URLSearchParams | undefined;
    simulerApi({
      'GET /sessions': [200, pageDe([session])],
      'GET /sessions/s1/documents': [200, bilan()],
      'GET /exports': (_c, url) => {
        requete = url.searchParams;
        return fichier('formactiv-resultats-2026-09-28.pdf');
      },
    });
    rendre(<PageDocumentsSession />, { utilisateur: resp, route: '/documents?session=s1' });
    await userEvent.click(await screen.findByRole('button', { name: 'Exporter la session (PDF)' }));
    await waitFor(() => expect(clics).toHaveLength(1));
    expect(Object.fromEntries(requete!)).toEqual({
      jeu: 'resultats',
      format: 'pdf',
      sessionId: 's1',
    });
    expect(clics[0].download).toBe('formactiv-resultats-2026-09-28.pdf');
  });

  it('présente le bilan en lecture seule hors responsable formation', async () => {
    simulerApi({
      'GET /sessions': [200, pageDe([session])],
      'GET /sessions/s1/documents': [200, bilan(false)],
    });
    rendre(<PageDocumentsSession />, {
      utilisateur: utilisateurTest({ role: 'FORMATEUR' }),
      route: '/documents?session=s1',
    });
    const ligneLea = await screen.findByRole('row', { name: /Léa Martin/ });
    expect(within(ligneLea).getByText('À générer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Générer/ })).not.toBeInTheDocument();
  });
});

describe('Écran Figma 20 — mes documents (UC-10)', () => {
  it('télécharge un document par URL signée', async () => {
    simulerApi({
      'GET /documents': [200, pageDe([{ ...documentGenere, reference: 'C-2026-0409' }])],
      'GET /documents/d1': [
        200,
        {
          url: '/api/v1/documents/d1/fichier?expire=1&u=a1&signature=abc',
          expireLe: '2026-09-28T10:05:00Z',
          nomFichier: 'formactiv-C-2026-0409.pdf',
        },
      ],
    });
    rendre(<PageMesDocuments />, { utilisateur: lea, route: '/mes-documents' });

    const ligneDoc = await screen.findByRole('row', { name: /C-2026-0409/ });
    expect(within(ligneDoc).getByText('Cybersécurité fondamentaux')).toBeInTheDocument();
    expect(within(ligneDoc).getByText('28/09/2026')).toBeInTheDocument();
    await userEvent.click(
      within(ligneDoc).getByRole('button', { name: 'Télécharger certificat C-2026-0409 (PDF)' }),
    );
    await waitFor(() => expect(clics).toHaveLength(1));
    expect(clics[0].getAttribute('href')).toBe(
      '/api/v1/documents/d1/fichier?expire=1&u=a1&signature=abc',
    );
    expect(clics[0].download).toBe('formactiv-C-2026-0409.pdf');
  });

  it('annonce l’absence de document', async () => {
    simulerApi({ 'GET /documents': [200, pageDe([])] });
    rendre(<PageMesDocuments />, { utilisateur: lea, route: '/mes-documents' });
    expect(await screen.findByText('Aucun document pour le moment')).toBeInTheDocument();
  });

  it('signale un lien expiré ou refusé', async () => {
    simulerApi({
      'GET /documents': [200, pageDe([documentGenere])],
      'GET /documents/d1': () =>
        reponseJson(404, { code: 'DOCUMENT_INTROUVABLE', message: 'Document introuvable.' }),
    });
    rendre(<PageMesDocuments />, { utilisateur: lea, route: '/mes-documents' });
    await userEvent.click(
      await screen.findByRole('button', { name: /Télécharger certificat C-2026-0413/ }),
    );
    expect(await screen.findByText('Document introuvable.')).toBeInTheDocument();
    expect(clics).toHaveLength(0);
  });
});

describe('Écran Figma 19 — mon parcours (RG-HIST-01)', () => {
  const etape = (id: string, intitule: string, surcharges: object) => ({
    inscriptionId: id,
    statut: 'TERMINEE',
    dateInscription: '2026-08-01T10:00:00Z',
    formation: { id: `f-${id}`, intitule, dureeHeures: 35 },
    session: {
      id: `s-${id}`,
      dateDebut: '2026-09-14',
      dateFin: '2026-09-18',
      lieu: null,
      enCours: false,
    },
    moyenne: 15,
    partielle: false,
    competencesAcquises: 3,
    competencesVisees: 3,
    evaluations: [],
    documents: [],
    ...surcharges,
  });

  it('présente l’historique, les moyennes et la progression par compétence', async () => {
    simulerApi({
      'GET /utilisateurs/a1/parcours': [
        200,
        {
          apprenant: { id: 'a1', prenom: 'Léa', nom: 'Martin' },
          etapes: [
            etape('i1', 'Cybersécurité fondamentaux', {}),
            etape('i2', 'Développement web', {
              statut: 'VALIDEE',
              moyenne: 13.5,
              partielle: true,
              competencesAcquises: 4,
              competencesVisees: 6,
              session: {
                id: 's2',
                dateDebut: '2026-09-18',
                dateFin: '2026-10-02',
                lieu: null,
                enCours: true,
              },
            }),
          ],
          competences: [
            {
              id: 'c1',
              libelle: 'Sécuriser un SI',
              typeReferentiel: 'RNCP',
              codeRncp: null,
              meilleureNote: 15,
              acquise: true,
              progression: 100,
            },
            {
              id: 'c2',
              libelle: 'JavaScript',
              typeReferentiel: 'INTERNE',
              codeRncp: null,
              meilleureNote: 5,
              acquise: false,
              progression: 50,
            },
          ],
        },
      ],
    });
    rendre(<PageParcours />, { utilisateur: lea, route: '/mon-parcours' });

    const tableau = await screen.findByRole('table', {
      name: 'Parcours de formation de Léa Martin',
    });
    const cyber = within(tableau).getByRole('row', { name: /Cybersécurité/ });
    expect(within(cyber).getByText('09/2026')).toBeInTheDocument();
    expect(within(cyber).getByText('15,0 / 20')).toBeInTheDocument();
    expect(within(cyber).getByText('3 / 3 acquises')).toBeInTheDocument();
    const web = within(tableau).getByRole('row', { name: /Développement web/ });
    expect(within(web).getByText('en cours')).toBeInTheDocument();
    expect(within(web).getByText('13,5 / 20 (partiel)')).toBeInTheDocument();
    expect(screen.getByText('100 % — acquise')).toBeInTheDocument();
    expect(screen.getByText('50 % — en cours')).toBeInTheDocument();
  });

  it('formate la moyenne', () => {
    expect(libelleMoyenne({ moyenne: null, partielle: false })).toBe('—');
    expect(libelleMoyenne({ moyenne: 12, partielle: false })).toBe('12,0 / 20');
  });
});

describe('Exports (UC-11, RG-EXP-01)', () => {
  it('limite les filtres du client entreprise et transmet sa demande', async () => {
    let requete: URLSearchParams | undefined;
    simulerApi({
      'GET /exports': (_c, url) => {
        requete = url.searchParams;
        return fichier('formactiv-evaluations-2026-09-28.csv');
      },
    });
    rendre(<PageExports />, { utilisateur: client, route: '/entreprise/exports' });

    expect(screen.queryByLabelText('Entreprise')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Formation')).not.toBeInTheDocument();
    const u = userEvent.setup();
    await u.selectOptions(screen.getByLabelText('Données'), 'evaluations');
    expect(
      screen.getByText('Synthèse acquise / non acquise, sans note détaillée.'),
    ).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Exporter' }));
    await waitFor(() => expect(clics).toHaveLength(1));
    expect(Object.fromEntries(requete!)).toEqual({ jeu: 'evaluations', format: 'csv' });
    expect(await screen.findByText('Export téléchargé.')).toBeInTheDocument();
  });

  it('refuse une période incohérente sans appeler l’API', async () => {
    const { appels } = simulerApi({
      'GET /formations': [200, pageDe([])],
      'GET /sessions': [200, pageDe([])],
      'GET /entreprises': [200, pageDe([])],
    });
    rendre(<PageExports />, { utilisateur: resp, route: '/exports' });
    expect(screen.getByLabelText('Entreprise')).toBeInTheDocument();
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Sessions terminées à partir du'), '2026-12-31');
    await u.type(screen.getByLabelText('Sessions commencées jusqu’au'), '2026-01-01');
    await u.click(screen.getByRole('button', { name: 'Exporter' }));
    expect(screen.getByText('La fin de période doit suivre son début.')).toBeInTheDocument();
    expect(appels.some((a) => a.cle === 'GET /exports')).toBe(false);
  });
});
