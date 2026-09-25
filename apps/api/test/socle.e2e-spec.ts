import request from 'supertest';
import { ContexteTest, demarrerApplication } from './utils/application';

describe('Socle HTTP (sécurité transverse, conventions ch. 9)', () => {
  let ctx: ContexteTest;

  beforeAll(async () => {
    ctx = await demarrerApplication();
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  it('GET /api/v1/sante répond ok quand la base est joignable', async () => {
    const res = await request(ctx.http).get('/api/v1/sante').expect(200);
    expect(res.body).toMatchObject({ statut: 'ok', base: 'ok' });
  });

  it('pose les en-têtes de sécurité (OWASP A05)', async () => {
    const res = await request(ctx.http).get('/api/v1/sante');
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers['strict-transport-security']).toContain('max-age=31536000');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('renvoie des erreurs normalisées sans détail technique', async () => {
    const res = await request(ctx.http).get('/api/v1/inexistant').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, code: 'RESSOURCE_INTROUVABLE' });
    expect(res.body.idRequete).toBe(res.headers['x-request-id']);
    expect(res.body).not.toHaveProperty('stack');
  });

  it("n'autorise le CORS que pour l'origine du front", async () => {
    const autorisee = await request(ctx.http)
      .options('/api/v1/sante')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');
    expect(autorisee.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const refusee = await request(ctx.http)
      .options('/api/v1/sante')
      .set('Origin', 'https://site-malveillant.example')
      .set('Access-Control-Request-Method', 'GET');
    expect(refusee.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejette les corps de requête trop volumineux', async () => {
    const res = await request(ctx.http)
      .post('/api/v1/sante')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ donnees: 'x'.repeat(200 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.code).toBe('CHARGE_TROP_VOLUMINEUSE');
  });

  it('rejette un JSON malformé avec une erreur 400 explicite', async () => {
    const res = await request(ctx.http)
      .post('/api/v1/sante')
      .set('Content-Type', 'application/json')
      .send('{"incomplet":');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('REQUETE_INVALIDE');
  });
});
