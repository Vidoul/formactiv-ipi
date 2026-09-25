import {
  formaterDate,
  formaterNote,
  formaterPlageDates,
  formaterPourcentage,
  initiales,
} from './formatage';

describe('formatage', () => {
  it('formate les dates calendaires sans décalage de fuseau', () => {
    expect(formaterDate('2026-09-14')).toBe('14/09/2026');
    expect(formaterDate(null)).toBe('—');
  });

  it('formate les plages de dates comme les maquettes', () => {
    expect(formaterPlageDates('2026-09-14', '2026-09-18')).toBe('14 au 18/09/2026');
    expect(formaterPlageDates('2026-09-28', '2026-10-02')).toBe('28/09 au 02/10/2026');
    expect(formaterPlageDates('2026-10-05', '2026-10-05')).toBe('05/10/2026');
  });

  it('formate notes et pourcentages en français', () => {
    expect(formaterNote(12.5)).toBe('12,5');
    expect(formaterNote(15)).toBe('15');
    expect(formaterPourcentage(0.874)).toBe('87 %');
    expect(formaterPourcentage(null)).toBe('—');
  });

  it("calcule les initiales de l'avatar", () => {
    expect(initiales('Nadia', 'Rey')).toBe('NR');
  });
});
