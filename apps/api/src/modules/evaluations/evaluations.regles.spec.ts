import { arrondirNote, estAcquise, noteValide, syntheseAcquisition } from './evaluations.regles';

describe('RG-EVAL-02 — acquisition des compétences', () => {
  it('considère une compétence acquise lorsque la note atteint le seuil', () => {
    expect(estAcquise(10, 10)).toBe(true);
    expect(estAcquise(9.99, 10)).toBe(false);
    expect(estAcquise(13.5, 12)).toBe(true);
    expect(estAcquise(11.99, 12)).toBe(false);
  });

  it('arrondit au centième avant comparaison (colonne DECIMAL(4,2))', () => {
    expect(arrondirNote(12.345)).toBe(12.35);
    expect(estAcquise(9.996, 10)).toBe(true);
  });

  it('borne les notes entre 0 et 20', () => {
    expect(noteValide(0)).toBe(true);
    expect(noteValide(20)).toBe(true);
    expect(noteValide(20.5)).toBe(false);
    expect(noteValide(-1)).toBe(false);
    expect(noteValide(Number.NaN)).toBe(false);
  });

  it('synthétise « compétences acquises » en ignorant les notes manquantes', () => {
    expect(syntheseAcquisition([15, 13, 17], 10)).toEqual({ acquises: 3, total: 3 });
    expect(syntheseAcquisition([12, 8, 14], 10)).toEqual({ acquises: 2, total: 3 });
    expect(syntheseAcquisition([16, null], 10)).toEqual({ acquises: 1, total: 2 });
  });
});
