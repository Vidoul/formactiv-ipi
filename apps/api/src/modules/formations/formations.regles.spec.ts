import { StatutFormation } from '@prisma/client';
import {
  controlerTransition,
  estSupprimable,
  normaliserPrerequis,
  visibleDuPublic,
} from './formations.regles';

const brouillon = { statut: StatutFormation.BROUILLON, nombreCompetences: 2, nombreSessions: 0 };

describe('Règles du catalogue (UC-04)', () => {
  describe('RG-FORM-03 — cycle de vie', () => {
    it('autorise brouillon → publiée → archivée → publiée', () => {
      expect(controlerTransition(brouillon, StatutFormation.PUBLIEE)).toBeNull();
      expect(controlerTransition({ ...brouillon, statut: 'PUBLIEE' }, 'ARCHIVEE')).toBeNull();
      expect(controlerTransition({ ...brouillon, statut: 'ARCHIVEE' }, 'PUBLIEE')).toBeNull();
    });

    it('refuse brouillon → archivée', () => {
      expect(controlerTransition(brouillon, StatutFormation.ARCHIVEE)).toMatch(/non autorisée/);
    });

    it('RG-FORM-02 : refuse la publication sans compétence visée', () => {
      expect(
        controlerTransition({ ...brouillon, nombreCompetences: 0 }, StatutFormation.PUBLIEE),
      ).toMatch(/au moins une compétence/);
    });

    it('refuse le retour en brouillon d’une formation ayant des sessions', () => {
      expect(
        controlerTransition({ ...brouillon, statut: 'PUBLIEE', nombreSessions: 1 }, 'BROUILLON'),
      ).toMatch(/archivez/);
    });

    it('ne rend visibles du public que les formations publiées', () => {
      expect(visibleDuPublic(StatutFormation.PUBLIEE)).toBe(true);
      expect(visibleDuPublic(StatutFormation.BROUILLON)).toBe(false);
      expect(visibleDuPublic(StatutFormation.ARCHIVEE)).toBe(false);
    });
  });

  it('RG-FORM-01 : prérequis « Aucun » par défaut', () => {
    expect(normaliserPrerequis('  ')).toBe('Aucun');
    expect(normaliserPrerequis(undefined)).toBe('Aucun');
    expect(normaliserPrerequis(' Bases en informatique ')).toBe('Bases en informatique');
  });

  it('ne supprime physiquement qu’un brouillon sans session', () => {
    expect(estSupprimable(brouillon)).toBe(true);
    expect(estSupprimable({ ...brouillon, nombreSessions: 1 })).toBe(false);
    expect(estSupprimable({ ...brouillon, statut: 'PUBLIEE' })).toBe(false);
  });
});
