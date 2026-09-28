import { StatutInscription } from '@prisma/client';
import {
  agreger,
  anneeCivile,
  certificatObtenu,
  debutTrimestre,
  ecartPoints,
  moisDeLaPeriode,
  periodePrecedente,
  ratio,
  trimestreDe,
  trimestresDeLaPeriode,
  variation,
  type LigneIndicateur,
} from './reporting.regles';

const ligne = (surcharges: Partial<LigneIndicateur>): LigneIndicateur => ({
  apprenantId: 'a1',
  statut: StatutInscription.TERMINEE,
  formationId: 'f1',
  intitule: 'Cybersécurité',
  dateDebut: '2026-09-14',
  sessionEchue: true,
  competencesVisees: 3,
  competencesAcquises: 3,
  score: null,
  ...surcharges,
});

describe('Indicateurs RG-DASH-01', () => {
  it('calcule réussite, complétion et satisfaction selon les définitions proposées', () => {
    const a = agreger([
      ligne({ apprenantId: 'a1', score: 5 }),
      ligne({ apprenantId: 'a2', competencesAcquises: 2, score: 4 }),
      ligne({ apprenantId: 'a3', statut: StatutInscription.VALIDEE }),
      ligne({ apprenantId: 'a4', statut: StatutInscription.EN_ATTENTE }),
      ligne({ apprenantId: 'a5', statut: StatutInscription.ANNULEE, score: 1 }),
      ligne({ apprenantId: 'a1', formationId: 'f2', statut: StatutInscription.VALIDEE }),
      // Session à venir : comptée dans les inscriptions, pas dans la complétion.
      ligne({ apprenantId: 'a6', statut: StatutInscription.VALIDEE, sessionEchue: false }),
    ]);
    expect(a).toEqual({
      inscriptions: 6,
      apprenants: 5,
      validees: 5,
      terminees: 2,
      certificats: 1,
      tauxCompletion: 0.5,
      tauxReussite: 0.5,
      satisfaction: { moyenne: 3.3, reponses: 3 },
    });
  });

  it('renvoie des taux nuls (non calculables) sans inscription', () => {
    expect(agreger([])).toMatchObject({
      inscriptions: 0,
      tauxCompletion: null,
      tauxReussite: null,
      satisfaction: { moyenne: null, reponses: 0 },
    });
    expect(ratio(1, 0)).toBeNull();
    expect(ratio(2, 3)).toBe(0.667);
  });

  it('ne compte un certificat que si toutes les compétences visées sont acquises', () => {
    expect(certificatObtenu(ligne({}))).toBe(true);
    expect(certificatObtenu(ligne({ competencesAcquises: 2 }))).toBe(false);
    expect(certificatObtenu(ligne({ competencesVisees: 0, competencesAcquises: 0 }))).toBe(false);
    expect(certificatObtenu(ligne({ statut: StatutInscription.VALIDEE }))).toBe(false);
  });
});

describe('Périodes et comparaisons (RG-DASH-03)', () => {
  it('calcule la période précédente de même durée', () => {
    expect(periodePrecedente({ du: '2026-07-01', au: '2026-09-30' })).toEqual({
      du: '2026-03-31',
      au: '2026-06-30',
    });
    expect(periodePrecedente({ du: '2026-01-01', au: '2026-12-31' })).toEqual({
      du: '2025-01-01',
      au: '2025-12-31',
    });
  });

  it('liste les mois de la période', () => {
    expect(moisDeLaPeriode({ du: '2026-11-15', au: '2027-02-01' })).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
    expect(moisDeLaPeriode(anneeCivile('2026-09-28'))).toHaveLength(12);
  });

  it('découpe la période en trimestres', () => {
    expect(trimestreDe('2026-09-30')).toBe('2026-T3');
    expect(trimestreDe('2026-10-01')).toBe('2026-T4');
    expect(debutTrimestre('2026-T4')).toBe('2026-10-01');
    expect(trimestresDeLaPeriode(anneeCivile('2026-05-02'))).toEqual([
      '2026-T1',
      '2026-T2',
      '2026-T3',
      '2026-T4',
    ]);
  });

  it('exprime les variations en pourcentage et en points', () => {
    expect(variation(236, 212)).toBe(11);
    expect(variation(5, 0)).toBeNull();
    expect(ecartPoints(0.87, 0.85)).toBe(2);
    expect(ecartPoints(0.87, null)).toBeNull();
  });
});
