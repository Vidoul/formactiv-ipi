import { ajouterJours, aujourdhui, dateIsoValide, depuisIso, jourMois, versIso } from './dates';

describe('Dates calendaires', () => {
  it('évalue « aujourd’hui » dans le fuseau de Paris', () => {
    // 23 h 30 UTC le 31 décembre = 0 h 30 le 1er janvier à Paris.
    expect(aujourdhui(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
    // Heure d'été : 22 h 30 UTC = 0 h 30 le lendemain.
    expect(aujourdhui(new Date('2026-07-14T22:30:00Z'))).toBe('2026-07-15');
  });

  it('décale et convertit les dates ISO', () => {
    expect(ajouterJours('2026-02-27', 2)).toBe('2026-03-01');
    expect(ajouterJours('2026-01-01', -1)).toBe('2025-12-31');
    expect(versIso(depuisIso('2026-09-14'))).toBe('2026-09-14');
    expect(jourMois('2026-09-14')).toBe('14/09');
  });

  it('refuse les dates inexistantes que Date décalerait silencieusement', () => {
    expect(dateIsoValide('2026-02-28')).toBe(true);
    expect(dateIsoValide('2028-02-29')).toBe(true);
    for (const invalide of [
      '2026-02-29',
      '2026-02-30',
      '2026-04-31',
      '2026-13-01',
      '26-01-01',
      '',
    ]) {
      expect(dateIsoValide(invalide)).toBe(false);
    }
  });
});
