import { CodeRole, Modalite, Prisma, TypeReferentiel } from '@prisma/client';
import { ContexteTest, demarrerApplication, reinitialiserBase } from './utils/application';

/**
 * Contraintes de gestion portées par la base (chapitres 6 et 8) : même si une règle venait à
 * être contournée côté API, PostgreSQL refuse la donnée incohérente.
 */
describe('Modèle de données — contraintes PostgreSQL', () => {
  let ctx: ContexteTest;
  let formationId: string;
  let apprenantId: string;

  beforeAll(async () => {
    ctx = await demarrerApplication();
    await reinitialiserBase(ctx.prisma);
    const role = await ctx.prisma.role.findUniqueOrThrow({ where: { code: CodeRole.APPRENANT } });
    apprenantId = (
      await ctx.prisma.utilisateur.create({
        data: { nom: 'Martin', prenom: 'Léa', email: 'lea@test.fr', roleId: role.id },
      })
    ).id;
    formationId = (
      await ctx.prisma.formation.create({
        data: {
          intitule: 'Cybersécurité',
          dureeHeures: 35,
          modalite: Modalite.HYBRIDE,
          prerequis: 'Aucun',
        },
      })
    ).id;
  });
  afterAll(async () => {
    await ctx.app.close();
  });

  const session = (debut: string, fin: string, capaciteMax?: number) =>
    ctx.prisma.session.create({
      data: { formationId, dateDebut: new Date(debut), dateFin: new Date(fin), capaciteMax },
    });

  it('RG-SESS-01 : refuse une session dont la fin précède le début', async () => {
    await expect(session('2026-09-18', '2026-09-14')).rejects.toThrow(/session_dates_coherentes/);
    await expect(session('2026-09-14', '2026-09-14')).resolves.toBeDefined();
  });

  it('RG-SESS-03 : refuse une capacité nulle ou négative', async () => {
    await expect(session('2026-10-01', '2026-10-02', 0)).rejects.toThrow(/capacite_positive/);
  });

  it('RG-INSC-01 : refuse une double inscription à la même session', async () => {
    const s = await session('2026-11-01', '2026-11-05');
    await ctx.prisma.inscription.create({ data: { apprenantId, sessionId: s.id } });
    await expect(
      ctx.prisma.inscription.create({ data: { apprenantId, sessionId: s.id } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('RG-COMP-01 : exige un code RNCP et un libellé unique par référentiel', async () => {
    await expect(
      ctx.prisma.competence.create({
        data: { libelle: 'Analyser les risques', typeReferentiel: TypeReferentiel.RNCP },
      }),
    ).rejects.toThrow(/competence_code_rncp/);

    await ctx.prisma.competence.create({
      data: { libelle: 'SQL', typeReferentiel: TypeReferentiel.INTERNE },
    });
    await expect(
      ctx.prisma.competence.create({
        data: { libelle: 'SQL', typeReferentiel: TypeReferentiel.INTERNE },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('borne les notes entre 0 et 20', async () => {
    const s = await session('2026-12-01', '2026-12-02');
    const insc = await ctx.prisma.inscription.create({ data: { apprenantId, sessionId: s.id } });
    const comp = await ctx.prisma.competence.create({
      data: { libelle: 'Phishing', typeReferentiel: TypeReferentiel.INTERNE },
    });
    await expect(
      ctx.prisma.evaluation.create({
        data: {
          inscriptionId: insc.id,
          competenceId: comp.id,
          note: new Prisma.Decimal(20.5),
          acquise: true,
          formateurId: apprenantId,
        },
      }),
    ).rejects.toThrow(/evaluation_note_bornee/);
  });

  it("refuse deux comptes dont l'email ne diffère que par la casse", async () => {
    const role = await ctx.prisma.role.findUniqueOrThrow({ where: { code: CodeRole.APPRENANT } });
    await expect(
      ctx.prisma.utilisateur.create({
        data: { nom: 'X', prenom: 'Y', email: 'LEA@test.fr', roleId: role.id },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  describe('RG-LOG-01 : journal en écriture seule', () => {
    it('interdit toute modification d’une entrée', async () => {
      const entree = await ctx.prisma.journalAction.create({ data: { action: 'TEST' } });
      await expect(
        ctx.prisma.journalAction.update({ where: { id: entree.id }, data: { details: 'modifié' } }),
      ).rejects.toThrow(/écriture seule/);
    });

    it('interdit la suppression d’une entrée récente mais autorise la purge des entrées échues', async () => {
      const recente = await ctx.prisma.journalAction.create({ data: { action: 'TEST' } });
      await expect(ctx.prisma.journalAction.delete({ where: { id: recente.id } })).rejects.toThrow(
        /non échue/,
      );

      const ancienne = await ctx.prisma.journalAction.create({
        data: { action: 'TEST', dateAction: new Date(Date.now() - 400 * 86_400_000) },
      });
      await expect(
        ctx.prisma.journalAction.delete({ where: { id: ancienne.id } }),
      ).resolves.toBeDefined();
    });
  });
});
