import { bilanCompetence, moyenne, progression } from './parcours.regles';

describe('Calculs du parcours (RG-HIST-01)', () => {
  it('calcule la moyenne au dixième', () => {
    expect(moyenne([])).toBeNull();
    expect(moyenne([15])).toBe(15);
    expect(moyenne([12, 15, 13.5])).toBe(13.5);
    expect(moyenne([10, 10, 11])).toBe(10.3);
  });

  it('calcule la progression vers le seuil', () => {
    expect(progression(null, 10)).toBe(0);
    expect(progression(5, 10)).toBe(50);
    expect(progression(10, 10)).toBe(100);
    expect(progression(18, 10)).toBe(100);
    expect(progression(7, 14)).toBe(50);
  });

  it('retient la meilleure évaluation d’une compétence', () => {
    expect(bilanCompetence([])).toEqual({ meilleureNote: null, acquise: false, progression: 0 });
    expect(
      bilanCompetence([
        { competenceId: 'c', note: 8, acquise: false, seuil: 10 },
        { competenceId: 'c', note: 12, acquise: true, seuil: 10 },
      ]),
    ).toEqual({ meilleureNote: 12, acquise: true, progression: 100 });
    expect(bilanCompetence([{ competenceId: 'c', note: 6, acquise: false, seuil: 12 }])).toEqual({
      meilleureNote: 6,
      acquise: false,
      progression: 50,
    });
  });
});
