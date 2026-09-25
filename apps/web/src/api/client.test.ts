import { ErreurApi, api, construireUrl, nomFichierDepuisEntete, sessionApi } from './client';

function reponseJson(status: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('client API', () => {
  const fetchSimule = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchSimule.mockReset();
    vi.stubGlobal('fetch', fetchSimule);
    sessionApi.definirJeton(null);
    sessionApi.definirRafraichisseur(null);
    sessionApi.definirGestionnaireExpiration(null);
  });

  it('construit les URL sous /api/v1 en ignorant les filtres vides', () => {
    expect(construireUrl('/sessions', { page: 2, formationId: '', statut: undefined })).toBe(
      '/api/v1/sessions?page=2',
    );
  });

  it("joint l'access token en en-tête Bearer (jamais en paramètre d'URL)", async () => {
    sessionApi.definirJeton('jeton-123');
    fetchSimule.mockResolvedValue(reponseJson(200, { ok: true }));
    await api.get('/formations');
    const [url, init] = fetchSimule.mock.calls[0];
    expect(url).toBe('/api/v1/formations');
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer jeton-123');
    expect(init?.credentials).toBe('same-origin');
  });

  it('transforme les erreurs normalisées en ErreurApi avec erreurs par champ', async () => {
    fetchSimule.mockResolvedValue(
      reponseJson(400, {
        statusCode: 400,
        code: 'VALIDATION',
        message: 'Certaines données sont invalides.',
        details: [{ champ: 'intitule', messages: ['intitule ne doit pas être vide'] }],
      }),
    );
    const erreur = await api.post('/formations', {}).catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ErreurApi);
    expect((erreur as ErreurApi).status).toBe(400);
    expect((erreur as ErreurApi).erreursChamps).toEqual({
      intitule: 'intitule ne doit pas être vide',
    });
  });

  it('rafraîchit la session une seule fois sur 401 puis rejoue la requête', async () => {
    const rafraichir = vi.fn(async () => {
      sessionApi.definirJeton('nouveau');
      return true;
    });
    sessionApi.definirRafraichisseur(rafraichir);
    fetchSimule
      .mockResolvedValueOnce(reponseJson(401, { code: 'NON_AUTHENTIFIE' }))
      .mockResolvedValueOnce(reponseJson(401, { code: 'NON_AUTHENTIFIE' }))
      .mockImplementation(async () => reponseJson(200, { ok: true }));

    await Promise.all([api.get('/a'), api.get('/b')]);
    expect(rafraichir).toHaveBeenCalledTimes(1);
    const dernier = fetchSimule.mock.calls.at(-1)?.[1];
    expect((dernier?.headers as Record<string, string>).Authorization).toBe('Bearer nouveau');
  });

  it('signale la session expirée si le rafraîchissement échoue', async () => {
    const expiree = vi.fn();
    sessionApi.definirRafraichisseur(async () => false);
    sessionApi.definirGestionnaireExpiration(expiree);
    fetchSimule.mockImplementation(async () =>
      reponseJson(401, { code: 'NON_AUTHENTIFIE', message: 'x' }),
    );
    await expect(api.get('/formations')).rejects.toMatchObject({ status: 401 });
    expect(expiree).toHaveBeenCalledOnce();
  });

  it('lit le nom de fichier proposé par Content-Disposition', () => {
    expect(nomFichierDepuisEntete('attachment; filename="bilan.pdf"')).toBe('bilan.pdf');
    expect(nomFichierDepuisEntete("attachment; filename*=UTF-8''r%C3%A9sultats.csv")).toBe(
      'résultats.csv',
    );
    expect(nomFichierDepuisEntete(null)).toBeUndefined();
  });
});
