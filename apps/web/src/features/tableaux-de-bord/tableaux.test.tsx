import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach } from 'vitest';
import { simulerApi } from '../../test/api-simulee';
import { pageDe, rendre, utilisateurTest } from '../../test/rendu';
import type { Indicateurs, TableauApprenant } from './api';
import PagePilotage from './PagePilotage';
import PageSalaries, { libelleAvancement } from './PageSalaries';
import PageTableauAdministration from './PageTableauAdministration';
import PageTableauApprenant, { detailDocuments, libelleProgression } from './PageTableauApprenant';
import PageTableauEntreprise from './PageTableauEntreprise';
import PageTableauFormateur from './PageTableauFormateur';
import { bornesPeriode, libelleEcartPoints, libelleVariation } from './periodes';

const agregat = {
  inscriptions: 236,
  apprenants: 180,
  validees: 200,
  terminees: 150,
  certificats: 130,
  tauxCompletion: 0.92,
  tauxReussite: 0.87,
  satisfaction: { moyenne: 4.2, reponses: 128 },
};

const indicateurs: Indicateurs = {
  periode: { du: '2026-07-01', au: '2026-09-30' },
  indicateurs: agregat,
  comparaison: {
    periode: { du: '2026-04-01', au: '2026-06-30' },
    tauxReussitePoints: 2,
    tauxCompletionPoints: 0,
    inscriptionsPourcent: 11,
  },
  parMois: [
    { mois: '2026-07', inscriptions: 69, apprenants: 60 },
    { mois: '2026-08', inscriptions: 83, apprenants: 70 },
  ],
  parTrimestre: [
    { trimestre: '2026-T3', inscriptions: 152, apprenants: 18, previsionnel: false },
    { trimestre: '2026-T4', inscriptions: 11, apprenants: 11, previsionnel: true },
  ],
  parFormation: [
    {
      ...agregat,
      inscriptions: 64,
      tauxReussite: 0.91,
      satisfaction: { moyenne: 4.4, reponses: 40 },
      formation: { id: 'f1', intitule: 'Cybersécurité fondamentaux' },
      part: 0.44,
    },
  ],
};

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

describe('Périodes des filtres (RG-DASH-03)', () => {
  it('calcule les bornes des périodes proposées', () => {
    expect(bornesPeriode('trimestre', '2026-09-28')).toEqual({
      du: '2026-07-01',
      au: '2026-09-30',
    });
    expect(bornesPeriode('trimestre-precedent', '2026-02-10')).toEqual({
      du: '2025-10-01',
      au: '2025-12-31',
    });
    expect(bornesPeriode('annee', '2026-09-28')).toEqual({ du: '2026-01-01', au: '2026-12-31' });
    expect(bornesPeriode('12-mois', '2026-09-28')).toEqual({ du: '2025-10-01', au: '2026-09-30' });
  });

  it('formule les comparaisons', () => {
    expect(libelleEcartPoints(2)).toBe('+2 pts vs période précédente');
    expect(libelleEcartPoints(0)).toBe('stable vs période précédente');
    expect(libelleEcartPoints(null)).toBeUndefined();
    expect(libelleVariation(-4)).toBe('-4 % vs période précédente');
  });
});

describe('Écran Figma 09 — pilotage des formations', () => {
  it('affiche les indicateurs, le graphique et l’équivalent tableau puis applique les filtres', async () => {
    const requetes: URLSearchParams[] = [];
    simulerApi({
      'GET /reporting/indicateurs': (_c, url) => {
        requetes.push(url.searchParams);
        return new Response(JSON.stringify(indicateurs), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
      'GET /formations': [200, pageDe([{ id: 'f1', intitule: 'Cybersécurité fondamentaux' }])],
      'GET /entreprises': [200, pageDe([{ id: 'e1', raisonSociale: 'Groupe Oxalys' }])],
    });
    rendre(<PagePilotage />, { utilisateur: utilisateurTest(), route: '/pilotage' });

    expect(await screen.findByText('87 %')).toBeInTheDocument();
    expect(screen.getByText('+2 pts vs période précédente')).toBeInTheDocument();
    expect(screen.getByText('4,2 / 5')).toBeInTheDocument();
    expect(screen.getByText('128 réponses')).toBeInTheDocument();
    expect(screen.getByText('+11 % vs période précédente')).toBeInTheDocument();
    // Alternative textuelle du graphique (RGAA 1.3).
    const alternative = screen.getByRole('table', { name: /Inscriptions par mois/ });
    expect(within(alternative).getByRole('row', { name: /juillet 2026 69/ })).toBeInTheDocument();
    const tableau = screen.getByRole('table', { name: 'Indicateurs par formation' });
    expect(
      within(tableau).getByRole('row', {
        name: /Cybersécurité fondamentaux 64 92 % 91 % 4,4 \/ 5/,
      }),
    ).toBeInTheDocument();

    const u = userEvent.setup();
    await u.selectOptions(screen.getByLabelText('Période'), 'annee');
    await u.selectOptions(await screen.findByLabelText('Entreprise'), 'e1');
    await u.click(screen.getByRole('button', { name: 'Appliquer' }));
    await waitFor(() => expect(requetes.length).toBeGreaterThanOrEqual(2));
    const derniere = Object.fromEntries(requetes.at(-1)!);
    expect(derniere).toMatchObject({ entrepriseId: 'e1' });
    expect(derniere.du.endsWith('-01-01')).toBe(true);
  });
});

describe('Écran Figma 05 — administration', () => {
  it('présente la santé des comptes et les dernières actions sensibles', async () => {
    simulerApi({
      'GET /reporting/administration': [
        200,
        {
          comptesActifs: 2148,
          connexions: {
            total: 312,
            variation: 4,
            parJour: [
              { jour: '2026-09-21', connexions: 52 },
              { jour: '2026-09-22', connexions: 61 },
            ],
          },
          demandesRgpd: { enAttente: 3, suppressions: 1 },
          comptesVerrouilles: 2,
          dernieresActions: [
            {
              id: 'j1',
              date: '2026-09-28T07:12:00Z',
              auteur: { prenom: 'Alex', nom: 'Dupré' },
              action: 'CHANGEMENT_ROLE',
              typeObjet: 'utilisateur',
              details: null,
            },
            {
              id: 'j2',
              date: '2026-09-27T15:02:00Z',
              auteur: null,
              action: 'VERROUILLAGE_COMPTE',
              typeObjet: 'utilisateur',
              details: '5 échecs',
            },
          ],
        },
      ],
    });
    rendre(<PageTableauAdministration />, {
      utilisateur: utilisateurTest({ role: 'ADMIN' }),
      route: '/admin/tableau-de-bord',
    });
    expect(await screen.findByText('2 148')).toBeInTheDocument();
    expect(screen.getByText('dont 1 suppression')).toBeInTheDocument();
    expect(screen.getByText('après échecs de connexion')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /lundi 21\/09 52/ })).toBeInTheDocument();
    const journal = screen.getByRole('table', { name: 'Extrait du journal d’audit' });
    expect(
      within(journal).getByRole('row', { name: /Alex Dupré Changement de rôle/ }),
    ).toBeInTheDocument();
    expect(
      within(journal).getByRole('row', { name: /Système Verrouillage de compte — 5 échecs/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir le journal complet' })).toHaveAttribute(
      'href',
      '/admin/journal',
    );
  });
});

describe('Écran Figma 17 — mes groupes (formateur)', () => {
  it('présente la part des compétences validées par session', async () => {
    simulerApi({
      'GET /reporting/formateur': [
        200,
        {
          sessionsAVenir: 2,
          apprenantsSuivis: 23,
          acquisitionMoyenne: 0.87,
          parSession: [
            {
              sessionId: 's1',
              intitule: 'Cybersécurité fondamentaux',
              dateDebut: '2026-09-14',
              dateFin: '2026-09-18',
              apprenants: 12,
              partValidee: 0.64,
            },
            {
              sessionId: 's2',
              intitule: 'RGPD en pratique',
              dateDebut: '2026-10-05',
              dateFin: '2026-10-06',
              apprenants: 0,
              partValidee: null,
            },
          ],
        },
      ],
    });
    rendre(<PageTableauFormateur />, {
      utilisateur: utilisateurTest({ role: 'FORMATEUR' }),
      route: '/formateur/tableau-de-bord',
    });
    expect(await screen.findByText('87 %')).toBeInTheDocument();
    expect(screen.getByText('Cybersécurité fondamentaux (09/2026)')).toBeInTheDocument();
    expect(screen.getByText('64 % — 12 apprenants')).toBeInTheDocument();
    expect(screen.getByText('aucun apprenant évalué')).toBeInTheDocument();
  });
});

describe('Écran Figma 18 — mon tableau de bord (apprenant)', () => {
  const tableau: TableauApprenant = {
    formationsSuivies: 3,
    competences: { acquises: 9, total: 12 },
    documents: { total: 2, certificats: 1, attestations: 1 },
    progression: [
      {
        inscriptionId: 'i1',
        formation: 'Cybersécurité fondamentaux',
        statut: 'TERMINEE',
        etat: 'TERMINEE',
        competencesAcquises: 3,
        competencesVisees: 3,
        document: 'CERTIFICAT',
      },
      {
        inscriptionId: 'i2',
        formation: 'Développement web',
        statut: 'VALIDEE',
        etat: 'EN_COURS',
        competencesAcquises: 3,
        competencesVisees: 5,
        document: null,
      },
      {
        inscriptionId: 'i3',
        formation: 'Gestion de projet IT',
        statut: 'EN_ATTENTE',
        etat: 'A_VENIR',
        competencesAcquises: 0,
        competencesVisees: 2,
        document: null,
      },
    ],
    prochainesSessions: [
      {
        inscriptionId: 'i3',
        formation: 'Gestion de projet IT',
        dateDebut: '2026-10-12',
        dateFin: '2026-10-14',
        modalite: 'PRESENTIEL',
        lieu: 'Toulouse',
      },
    ],
    satisfactionAttendue: [{ inscriptionId: 'i1', formation: 'Cybersécurité fondamentaux' }],
    consentementSatisfaction: false,
  };
  const apprenant = utilisateurTest({ role: 'APPRENANT', prenom: 'Léa', nom: 'Martin' });

  it('présente la progression et les prochaines sessions', async () => {
    simulerApi({ 'GET /reporting/apprenant': [200, tableau] });
    rendre(<PageTableauApprenant />, { utilisateur: apprenant, route: '/mon-espace' });
    expect(await screen.findByRole('heading', { name: 'Bonjour Léa' })).toBeInTheDocument();
    expect(await screen.findByText('9 / 12')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 certificat, 1 attestation' })).toBeInTheDocument();
    expect(screen.getByText('Terminée — certificat obtenu')).toBeInTheDocument();
    expect(screen.getByText('En cours — 60 %')).toBeInTheDocument();
    expect(screen.getByText('À venir — inscription en attente')).toBeInTheDocument();
    const prochaines = screen.getByRole('table', { name: 'Sessions à venir' });
    expect(within(prochaines).getByText('Présentiel - Toulouse')).toBeInTheDocument();
  });

  it('recueille l’avis et le consentement explicite (RG-DASH-04, RG-RGPD-01)', async () => {
    const { appels } = simulerApi({
      'GET /reporting/apprenant': [200, tableau],
      'POST /inscriptions/i1/satisfaction': [201, { id: 'r1', score: 4 }],
    });
    rendre(<PageTableauApprenant />, { utilisateur: apprenant, route: '/mon-espace' });
    const u = userEvent.setup();
    await u.click(
      await screen.findByRole('button', { name: 'Donner mon avis sur Cybersécurité fondamentaux' }),
    );
    const dialogue = screen.getByRole('dialog', { name: 'Votre avis sur la formation' });
    await u.click(within(dialogue).getByRole('button', { name: 'Envoyer mon avis' }));
    expect(
      within(dialogue).getByText(
        'Pour envoyer votre avis, indiquez votre niveau de satisfaction et cochez la case d’accord.',
      ),
    ).toBeInTheDocument();
    expect(appels.some((a) => a.cle.startsWith('POST'))).toBe(false);

    await u.click(within(dialogue).getByRole('radio', { name: '4 — Satisfait' }));
    const accord = within(dialogue).getByRole('checkbox', { name: /J’accepte/ });
    expect(accord).not.toBeChecked();
    await u.click(accord);
    await u.type(within(dialogue).getByLabelText('Commentaire (facultatif)'), 'Très concret');
    await u.click(within(dialogue).getByRole('button', { name: 'Envoyer mon avis' }));
    await waitFor(() =>
      expect(appels.find((a) => a.cle === 'POST /inscriptions/i1/satisfaction')?.corps).toEqual({
        score: 4,
        commentaire: 'Très concret',
        consentement: true,
      }),
    );
    expect(await screen.findByText('Merci, votre avis a été enregistré.')).toBeInTheDocument();
  });

  it('formule la progression', () => {
    expect(libelleProgression({ ...tableau.progression[0], document: 'ATTESTATION' })).toBe(
      'Terminée — attestation disponible',
    );
    expect(libelleProgression({ ...tableau.progression[0], document: null })).toBe(
      'Terminée — 3 / 3 compétences',
    );
    expect(
      libelleProgression({
        ...tableau.progression[0],
        document: null,
        competencesAcquises: 1,
        competencesVisees: 1,
      }),
    ).toBe('Terminée — 1 / 1 compétence');
    expect(detailDocuments({ total: 1, certificats: 1, attestations: 0 })).toBe('1 certificat');
  });
});

describe('Écrans Figma 21a et 21b — client entreprise', () => {
  const client = utilisateurTest({
    role: 'CLIENT_ENTREPRISE',
    prenom: 'Théo',
    nom: 'Morel',
    entreprise: { id: 'e1', raisonSociale: 'Groupe Oxalys' },
  });

  it('présente les indicateurs de ses salariés et exporte le bilan', async () => {
    let exportDemande: URLSearchParams | undefined;
    simulerApi({
      'GET /reporting/indicateurs': [
        200,
        { ...indicateurs, indicateurs: { ...agregat, apprenants: 18, certificats: 12 } },
      ],
      'GET /formations': [200, pageDe([])],
      'GET /exports': (_c, url) => {
        exportDemande = url.searchParams;
        return new Response('pdf', {
          headers: { 'Content-Disposition': 'attachment; filename="bilan.pdf"' },
        });
      },
    });
    rendre(<PageTableauEntreprise />, {
      utilisateur: client,
      route: '/entreprise/tableau-de-bord',
    });
    expect(
      await screen.findByRole('heading', { name: 'Groupe Oxalys - Suivi des formations' }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Salariés en formation', { selector: '.indicateur__libelle' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Entreprise')).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /T4 2026 \(prévision\) 11/ })).toBeInTheDocument();
    expect(screen.getByText('44 % — 64 inscriptions')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Exporter le bilan (PDF)' }));
    await waitFor(() => expect(clics).toHaveLength(1));
    expect(Object.fromEntries(exportDemande!)).toMatchObject({ jeu: 'resultats', format: 'pdf' });
    expect(exportDemande!.get('entrepriseId')).toBeNull();
  });

  it('liste ses salariés avec un avancement synthétique et filtre par statut', async () => {
    const requetes: URLSearchParams[] = [];
    const ligne = {
      inscriptionId: 'i1',
      apprenant: { id: 'a1', prenom: 'Marc', nom: 'Petit' },
      formation: { id: 'f2', intitule: 'Développement web' },
      session: { dateDebut: '2026-09-18', dateFin: '2026-10-02' },
      statut: 'VALIDEE',
      etat: 'EN_COURS',
      competencesAcquises: 4,
      competencesVisees: 6,
      documents: [],
    } as const;
    simulerApi({
      'GET /formations': [200, pageDe([])],
      'GET /reporting/salaries': (_c, url) => {
        requetes.push(url.searchParams);
        return new Response(
          JSON.stringify({ donnees: [ligne], total: 1, page: 1, limit: 20, salaries: 1 }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      },
    });
    rendre(<PageSalaries />, { utilisateur: client, route: '/entreprise/salaries' });
    const rangee = await screen.findByRole('row', { name: /Marc Petit/ });
    expect(within(rangee).getByText('67 % - 4/6 compétences')).toBeInTheDocument();
    expect(within(rangee).getByText('En cours')).toBeInTheDocument();
    expect(screen.getByText('1 salarié suivi.')).toBeInTheDocument();

    const u = userEvent.setup();
    await u.selectOptions(screen.getByLabelText('Statut'), 'A_VENIR');
    await u.click(screen.getByRole('button', { name: 'Appliquer' }));
    await waitFor(() => expect(requetes.at(-1)?.get('etat')).toBe('A_VENIR'));
  });

  it('formule l’avancement sans note détaillée', () => {
    const base = {
      inscriptionId: 'i',
      apprenant: { id: 'a', prenom: 'A', nom: 'B' },
      formation: { id: 'f', intitule: 'F' },
      session: { dateDebut: '2026-10-01', dateFin: '2026-10-02' },
      competencesAcquises: 0,
      competencesVisees: 2,
    };
    expect(
      libelleAvancement({
        ...base,
        statut: 'TERMINEE',
        etat: 'TERMINEE',
        documents: ['CERTIFICAT'],
      }),
    ).toBe('Certificat obtenu');
    expect(libelleAvancement({ ...base, statut: 'VALIDEE', etat: 'A_VENIR', documents: [] })).toBe(
      'Inscription validée',
    );
  });
});
