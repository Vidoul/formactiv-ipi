import { siretValide } from './siret';

describe('siretValide', () => {
  it('accepte un SIRET dont la clé de Luhn est correcte', () => {
    expect(siretValide('81234567800013')).toBe(true);
    expect(siretValide('73282932000074')).toBe(true);
  });

  it('refuse une clé incorrecte ou un format invalide', () => {
    expect(siretValide('81234567800018')).toBe(false);
    expect(siretValide('8123456780001')).toBe(false);
    expect(siretValide('8123456780001A')).toBe(false);
  });
});
