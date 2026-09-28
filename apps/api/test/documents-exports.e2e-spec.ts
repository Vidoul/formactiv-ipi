import {
  CodeRole,
  Modalite,
  StatutFormation,
  StatutInscription,
  TypeReferentiel,
} from '@prisma/client';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { ajouterJours, aujourdhui, depuisIso } from '../src/common/utils/dates';
import { ContexteTest, demarrerApplication, reinitialiserBase } from './utils/application';
import {
  autorisation,
  creerEntreprise,
  creerUtilisateur,
  type UtilisateurTest,
} from './utils/fabriques';

/** Lecture binaire des réponses PDF avec supertest (le flux reçu est la réponse HTTP brute). */
function binaire(
  res: request.Response,
  rappel: (erreur: Error | null, corps: Buffer) => void,
): void {
  const flux = res as unknown as NodeJS.ReadableStream;
  const morceaux: Buffer[] = [];
  flux.on('data', (m: Buffer) => morceaux.push(m));
  flux.on('end', () => rappel(null, Buffer.concat(morceaux)));
}

describe('Documents, parcours et exports (UC-09/10/11, RG-CERT-01/02, RG-HIST-01, RG-EXP-01)', () => {
  let ctx: ContexteTest;
  let resp: UtilisateurTest;
  let admin: UtilisateurTest;
  let karim: UtilisateurTest;
  let sonia: UtilisateurTest;
  let lea: UtilisateurTest;
  let paul: UtilisateurTest;
  let client: UtilisateurTest;
  let sessionId: string;
  let inscriptionLea: string;
  let inscriptionPaul: string;

  const J = aujourdhui();
  const ANNEE = J.slice(0, 4);
  const en = (u: UtilisateurTest) => ({ Authorization: autorisation(ctx, u) });
  const generer = (u: UtilisateurTest, inscriptionId: string, type: string) =>
    request(ctx.http)
      .post(`/api/v1/inscriptions/${inscriptionId}/documents`)
      .set(en(u))
      .send({ type });

  beforeAll(async () => {
    ctx = await demarrerApplication();
  });
  beforeEach(async () => {
    await reinitialiserBase(ctx.prisma);
    const oxalys = await creerEntreprise(ctx);
    resp = await creerUtilisateur(ctx, CodeRole.RESP_FORMATION, { prenom: 'Nadia', nom: 'Rey' });
    admin = await creerUtilisateur(ctx, CodeRole.ADMIN);
    karim = await creerUtilisateur(ctx, CodeRole.FORMATEUR);
    sonia = await creerUtilisateur(ctx, CodeRole.FORMATEUR);
    lea = await creerUtilisateur(ctx, CodeRole.APPRENANT, {
      prenom: 'Léa',
      nom: 'Martin',
      entrepriseId: oxalys.id,
    });
    paul = await creerUtilisateur(ctx, CodeRole.APPRENANT, { prenom: '@Paul', nom: 'Girard' });
    client = await creerUtilisateur(ctx, CodeRole.CLIENT_ENTREPRISE, { entrepriseId: oxalys.id });

    const competence = (libelle: string) =>
      ctx.prisma.competence.create({ data: { libelle, typeReferentiel: TypeReferentiel.INTERNE } });
    const securiser = (await competence('Sécuriser un SI')).id;
    const risques = (await competence('Analyser les risques')).id;
    const formation = await ctx.prisma.formation.create({
      data: {
        intitule: 'Cybersécurité fondamentaux',
        dureeHeures: 35,
        modalite: Modalite.PRESENTIEL,
        prerequis: 'Aucun',
        statut: StatutFormation.PUBLIEE,
        competences: { create: [{ competenceId: securiser }, { competenceId: risques }] },
      },
    });
    sessionId = (
      await ctx.prisma.session.create({
        data: {
          formationId: formation.id,
          dateDebut: depuisIso(ajouterJours(J, -10)),
          dateFin: depuisIso(ajouterJours(J, -6)),
          lieu: 'Toulouse',
          animations: { create: { formateurId: karim.id } },
        },
      })
    ).id;
    const inscrire = (apprenantId: string) =>
      ctx.prisma.inscription.create({
        data: { apprenantId, sessionId, statut: StatutInscription.TERMINEE },
      });
    inscriptionLea = (await inscrire(lea.id)).id;
    inscriptionPaul = (await inscrire(paul.id)).id;
    const noter = (inscriptionId: string, competenceId: string, note: number) =>
      ctx.prisma.evaluation.create({
        data: { inscriptionId, competenceId, note, acquise: note >= 10, formateurId: karim.id },
      });
    await noter(inscriptionLea, securiser, 15);
    await noter(inscriptionLea, risques, 13);
    await noter(inscriptionPaul, securiser, 12);
    await noter(inscriptionPaul, risques, 7.5);
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  // ------------------------------------------------------------------ Génération (UC-09)

  it('RG-CERT-01/02 : génère un certificat référencé, stocké avec son empreinte et journalisé', async () => {
    const reponse = await generer(resp, inscriptionLea, 'CERTIFICAT').expect(201);
    expect(reponse.body).toMatchObject({
      type: 'CERTIFICAT',
      reference: `C-${ANNEE}-0001`,
      apprenant: { prenom: 'Léa', nom: 'Martin' },
      emetteur: { prenom: 'Nadia', nom: 'Rey' },
      formation: { intitule: 'Cybersécurité fondamentaux' },
    });
    const enBase = await ctx.prisma.document.findUniqueOrThrow({ where: { id: reponse.body.id } });
    expect(enBase.fichier).toMatch(new RegExp(`^documents/${ANNEE}/[0-9a-f-]+\\.pdf$`));
    expect(enBase.empreinteSha256).toMatch(/^[0-9a-f]{64}$/);
    const trace = await ctx.prisma.journalAction.findFirst({
      where: { action: 'GENERATION_DOCUMENT', idObjet: reponse.body.id },
    });
    expect(trace).toMatchObject({ utilisateurId: resp.id });

    const suivant = await generer(resp, inscriptionLea, 'CERTIFICAT').expect(201);
    expect(suivant.body.reference).toBe(`C-${ANNEE}-0002`);
  });

  it('UC-09 A1 : sans toutes les compétences, seule l’attestation est générable', async () => {
    const refus = await generer(resp, inscriptionPaul, 'CERTIFICAT').expect(409);
    expect(refus.body).toMatchObject({ code: 'CERTIFICAT_NON_ELIGIBLE' });
    expect(refus.body.message).toMatch(/1 compétence\(s\) acquise\(s\) sur 2/);
    const attestation = await generer(resp, inscriptionPaul, 'ATTESTATION').expect(201);
    expect(attestation.body.reference).toBe(`A-${ANNEE}-0001`);
  });

  it('refuse la génération tant que l’inscription n’est pas terminée', async () => {
    await ctx.prisma.inscription.update({
      where: { id: inscriptionLea },
      data: { statut: StatutInscription.VALIDEE },
    });
    const refus = await generer(resp, inscriptionLea, 'ATTESTATION').expect(409);
    expect(refus.body.code).toBe('DOCUMENT_NON_ELIGIBLE');
    expect(await ctx.prisma.document.count()).toBe(0);
  });

  it('réserve la génération au responsable formation (matrice RBAC)', async () => {
    for (const u of [admin, karim, lea, client]) {
      await generer(u, inscriptionLea, 'ATTESTATION').expect(403);
    }
    await generer(resp, inscriptionLea, 'INCONNU').expect(400);
  });

  it('écran 14 : bilan de génération d’une session', async () => {
    await generer(resp, inscriptionLea, 'CERTIFICAT').expect(201);
    const bilan = await request(ctx.http)
      .get(`/api/v1/sessions/${sessionId}/documents`)
      .set(en(resp))
      .expect(200);
    expect(bilan.body.session).toMatchObject({ terminee: true });
    expect(bilan.body.peutGenerer).toBe(true);
    type Ligne = { apprenant: { prenom: string } };
    const lignes = bilan.body.lignes as Ligne[];
    const ligneLea = lignes.find((l) => l.apprenant.prenom === 'Léa');
    const lignePaul = lignes.find((l) => l.apprenant.prenom === '@Paul');
    expect(ligneLea).toMatchObject({
      apprenant: { prenom: 'Léa' },
      competencesAcquises: 2,
      competencesVisees: 2,
      documentPropose: 'CERTIFICAT',
      documents: [{ type: 'CERTIFICAT', reference: `C-${ANNEE}-0001` }],
    });
    expect(lignePaul).toMatchObject({
      documentPropose: 'ATTESTATION',
      typesGenerables: ['ATTESTATION'],
    });

    // Formateur affecté : consultation seule ; formateur non affecté et apprenant : hors portée.
    const formateur = await request(ctx.http)
      .get(`/api/v1/sessions/${sessionId}/documents`)
      .set(en(karim))
      .expect(200);
    expect(formateur.body.peutGenerer).toBe(false);
    await request(ctx.http)
      .get(`/api/v1/sessions/${sessionId}/documents`)
      .set(en(sonia))
      .expect(404);
    await request(ctx.http).get(`/api/v1/sessions/${sessionId}/documents`).set(en(lea)).expect(403);
  });

  // ------------------------------------------------------------------ Téléchargement (UC-10)

  describe('téléchargement par URL signée (ADR-05)', () => {
    let documentLea: string;

    beforeEach(async () => {
      documentLea = (await generer(resp, inscriptionLea, 'CERTIFICAT').expect(201)).body.id;
      await generer(resp, inscriptionPaul, 'ATTESTATION').expect(201);
    });

    const lien = async (u: UtilisateurTest, id = documentLea) =>
      (await request(ctx.http).get(`/api/v1/documents/${id}`).set(en(u)).expect(200)).body as {
        url: string;
        nomFichier: string;
      };

    it('US-20 : l’apprenant liste et télécharge ses seuls documents', async () => {
      const liste = await request(ctx.http).get('/api/v1/documents').set(en(lea)).expect(200);
      expect(liste.body.total).toBe(1);
      expect(liste.body.donnees[0]).toMatchObject({ id: documentLea, type: 'CERTIFICAT' });

      const { url, nomFichier } = await lien(lea);
      expect(nomFichier).toBe(`formactiv-C-${ANNEE}-0001.pdf`);
      const fichier = await request(ctx.http).get(url).buffer(true).parse(binaire).expect(200);
      expect(fichier.headers['content-type']).toBe('application/pdf');
      expect(fichier.headers['content-disposition']).toBe(`attachment; filename="${nomFichier}"`);
      expect(fichier.headers['cache-control']).toBe('no-store');
      expect((fichier.body as Buffer).subarray(0, 8).toString()).toBe('%PDF-1.7');
      const trace = await ctx.prisma.journalAction.findFirst({
        where: { action: 'TELECHARGEMENT_DOCUMENT', idObjet: documentLea },
      });
      expect(trace?.utilisateurId).toBe(lea.id);
    });

    it('applique la portée RBAC (apprenant, client entreprise, formateur)', async () => {
      await request(ctx.http).get(`/api/v1/documents/${documentLea}`).set(en(paul)).expect(404);
      const clientListe = await request(ctx.http)
        .get('/api/v1/documents')
        .set(en(client))
        .expect(200);
      expect(clientListe.body.donnees.map((d: { id: string }) => d.id)).toEqual([documentLea]);
      const formateur = await request(ctx.http).get('/api/v1/documents').set(en(karim)).expect(200);
      expect(formateur.body.total).toBe(2);
      const autre = await request(ctx.http).get('/api/v1/documents').set(en(sonia)).expect(200);
      expect(autre.body.total).toBe(0);
    });

    it('refuse un lien falsifié, détourné ou expiré', async () => {
      const { url } = await lien(lea);
      const falsifie = url.replace(/signature=[^&]+/, `signature=${'A'.repeat(43)}`);
      const refus = await request(ctx.http).get(falsifie).expect(403);
      expect(refus.body.code).toBe('LIEN_INVALIDE');
      // Lien obtenu par Léa rejoué au nom de Paul : la signature ne correspond plus.
      await request(ctx.http)
        .get(url.replace(`u=${lea.id}`, `u=${paul.id}`))
        .expect(403);
      const expire = url.replace(/expire=\d+/, 'expire=1000');
      await request(ctx.http).get(expire).expect(403);
      // Compte désactivé depuis l'obtention du lien.
      await ctx.prisma.utilisateur.update({
        where: { id: lea.id },
        data: { statutCompte: 'DESACTIVE' },
      });
      await request(ctx.http).get(url).expect(403);
    });

    it('OWASP A08 : refuse de remettre un fichier altéré et journalise l’anomalie', async () => {
      const { url } = await lien(resp);
      const { fichier } = await ctx.prisma.document.findUniqueOrThrow({
        where: { id: documentLea },
      });
      await writeFile(path.join(process.env.STORAGE_LOCAL_DIR!, fichier), '%PDF-1.7 falsifié');
      const refus = await request(ctx.http).get(url).expect(500);
      expect(refus.body.code).toBe('DOCUMENT_ALTERE');
      expect(
        await ctx.prisma.journalAction.count({ where: { action: 'INTEGRITE_DOCUMENT' } }),
      ).toBe(1);
    });

    it('RG-CPT-02 : l’anonymisation de l’apprenant remplace ses PDF nominatifs', async () => {
      const avant = await ctx.prisma.document.findUniqueOrThrow({ where: { id: documentLea } });
      const suppression = await request(ctx.http)
        .delete(`/api/v1/utilisateurs/${lea.id}`)
        .set(en(admin))
        .expect(200);
      expect(suppression.body.resultat).toBe('ANONYMISE');
      const apres = await ctx.prisma.document.findUniqueOrThrow({ where: { id: documentLea } });
      expect(apres.referenceUnique).toBe(avant.referenceUnique);
      expect(apres.fichier).not.toBe(avant.fichier);
      expect(apres.empreinteSha256).not.toBe(avant.empreinteSha256);
      // Le document reste téléchargeable par l'administration, intégrité vérifiée.
      const { url } = await lien(resp);
      await request(ctx.http).get(url).buffer(true).parse(binaire).expect(200);
    });
  });

  // ------------------------------------------------------------------ Parcours (RG-HIST-01)

  it('US-21 : parcours complet consultable par l’apprenant et l’administration seulement', async () => {
    await generer(resp, inscriptionLea, 'CERTIFICAT').expect(201);
    const parcours = await request(ctx.http)
      .get(`/api/v1/utilisateurs/${lea.id}/parcours`)
      .set(en(lea))
      .expect(200);
    expect(parcours.body.apprenant).toMatchObject({ prenom: 'Léa', nom: 'Martin' });
    expect(parcours.body.etapes).toHaveLength(1);
    expect(parcours.body.etapes[0]).toMatchObject({
      statut: 'TERMINEE',
      moyenne: 14,
      partielle: false,
      competencesAcquises: 2,
      competencesVisees: 2,
      formation: { intitule: 'Cybersécurité fondamentaux' },
      documents: [{ type: 'CERTIFICAT' }],
    });
    expect(parcours.body.competences).toEqual([
      expect.objectContaining({ libelle: 'Analyser les risques', acquise: true, progression: 100 }),
      expect.objectContaining({ libelle: 'Sécuriser un SI', meilleureNote: 15, progression: 100 }),
    ]);

    const paulParcours = await request(ctx.http)
      .get(`/api/v1/utilisateurs/${paul.id}/parcours`)
      .set(en(resp))
      .expect(200);
    expect(paulParcours.body.competences).toContainEqual(
      expect.objectContaining({ libelle: 'Analyser les risques', acquise: false, progression: 75 }),
    );
    for (const u of [paul, client, karim]) {
      await request(ctx.http).get(`/api/v1/utilisateurs/${lea.id}/parcours`).set(en(u)).expect(404);
    }
  });

  // ------------------------------------------------------------------ Exports (UC-11)

  describe('exports (RG-EXP-01)', () => {
    const exporter = (u: UtilisateurTest, requete: Record<string, string>) =>
      request(ctx.http).get('/api/v1/exports').query(requete).set(en(u));

    it('US-22 : export CSV des résultats pour le responsable formation', async () => {
      await generer(resp, inscriptionLea, 'CERTIFICAT').expect(201);
      const reponse = await exporter(resp, { jeu: 'resultats', format: 'csv', sessionId }).expect(
        200,
      );
      expect(reponse.headers['content-type']).toMatch(/^text\/csv/);
      expect(reponse.headers['content-disposition']).toBe(
        `attachment; filename="formactiv-resultats-${J}.csv"`,
      );
      expect(reponse.headers['x-nombre-lignes']).toBe('2');
      const lignes = reponse.text
        .replace(/^\uFEFF/, '')
        .trim()
        .split('\r\n');
      expect(lignes[0]).toBe(
        'Formation;Session;Apprenant;Entreprise;Statut;Compétences acquises;Moyenne /20;Documents',
      );
      expect(lignes).toContainEqual(
        expect.stringContaining(`Léa Martin;Groupe Oxalys;Terminée;2 / 2;14;C-${ANNEE}-0001`),
      );
      // Injection de formule neutralisée (cellule commençant par « @ »).
      expect(lignes).toContainEqual(expect.stringContaining(";'@Paul Girard;"));
      const trace = await ctx.prisma.journalAction.findFirst({ where: { action: 'EXPORT_CSV' } });
      expect(trace?.details).toContain('resultats — 2 ligne(s)');
    });

    it('limite l’export du client entreprise à ses salariés, sans note détaillée', async () => {
      const reponse = await exporter(client, { jeu: 'evaluations', format: 'csv' }).expect(200);
      const lignes = reponse.text
        .replace(/^\uFEFF/, '')
        .trim()
        .split('\r\n');
      expect(lignes[0]).not.toContain('Note');
      expect(lignes).toHaveLength(3);
      expect(lignes.slice(1).every((l) => l.includes('Léa Martin'))).toBe(true);
      const filtre = await exporter(client, {
        jeu: 'resultats',
        format: 'csv',
        entrepriseId: client.entrepriseId!,
      }).expect(403);
      expect(filtre.body.code).toBe('FILTRE_NON_AUTORISE');
    });

    it('limite l’export de l’apprenant et du formateur à leur portée', async () => {
      const apprenant = await exporter(paul, { jeu: 'inscriptions', format: 'csv' }).expect(200);
      expect(apprenant.headers['x-nombre-lignes']).toBe('1');
      expect(apprenant.text).not.toContain('Email');
      const formateur = await exporter(sonia, { jeu: 'inscriptions', format: 'csv' }).expect(200);
      expect(formateur.headers['x-nombre-lignes']).toBe('0');
      const administration = await exporter(resp, { jeu: 'inscriptions', format: 'csv' });
      expect(administration.status).toBe(200);
      expect(administration.text).toContain(lea.email);
    });

    it('produit un export PDF balisé et journalisé', async () => {
      const reponse = await exporter(resp, {
        jeu: 'evaluations',
        format: 'pdf',
        du: ajouterJours(J, -30),
      })
        .buffer(true)
        .parse(binaire)
        .expect(200);
      expect(reponse.headers['content-type']).toBe('application/pdf');
      const pdf = (reponse.body as Buffer).toString('latin1');
      expect(pdf.startsWith('%PDF-1.7')).toBe(true);
      expect(pdf).toContain('/S /Table');
      expect(await ctx.prisma.journalAction.count({ where: { action: 'EXPORT_PDF' } })).toBe(1);
    });

    it('valide le jeu, le format et la période', async () => {
      await exporter(resp, { jeu: 'utilisateurs', format: 'csv' }).expect(400);
      await exporter(resp, { jeu: 'resultats', format: 'xlsx' }).expect(400);
      await exporter(resp, { jeu: 'resultats', format: 'csv', du: '2026-13-01' }).expect(400);
      const periode = await exporter(resp, {
        jeu: 'resultats',
        format: 'csv',
        du: '2026-12-31',
        au: '2026-01-01',
      }).expect(400);
      expect(periode.body.code).toBe('PERIODE_INVALIDE');
      await request(ctx.http)
        .get('/api/v1/exports')
        .query({ jeu: 'resultats', format: 'csv' })
        .expect(401);
    });
  });
});
