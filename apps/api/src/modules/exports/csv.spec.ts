import { celluleCsv, genererCsv } from './csv';

describe('Export CSV', () => {
  it('neutralise les formules (injection CSV)', () => {
    expect(celluleCsv('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(celluleCsv('+33 6 00')).toBe("'+33 6 00");
    expect(celluleCsv('-2+3')).toBe("'-2+3");
    expect(celluleCsv('@SUM(A1)')).toBe("'@SUM(A1)");
    expect(celluleCsv('\tcmd')).toBe("'\tcmd");
  });

  it('échappe séparateurs, guillemets et retours à la ligne', () => {
    expect(celluleCsv('Dupont; Martin')).toBe('"Dupont; Martin"');
    expect(celluleCsv('Il a dit "oui"')).toBe('"Il a dit ""oui"""');
    expect(celluleCsv('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"');
  });

  it('formate nombres, booléens et valeurs vides à la française', () => {
    expect(celluleCsv(13.5)).toBe('13,5');
    expect(celluleCsv(-2)).toBe('-2');
    expect(celluleCsv(true)).toBe('Oui');
    expect(celluleCsv(false)).toBe('Non');
    expect(celluleCsv(null)).toBe('');
    expect(celluleCsv(undefined)).toBe('');
  });

  it('produit un fichier UTF-8 avec BOM et fins de ligne CRLF', () => {
    const fichier = genererCsv(['Apprenant', 'Note'], [['Léa Martin', 15]]).toString('utf8');
    expect(fichier).toBe('\uFEFFApprenant;Note\r\nLéa Martin;15\r\n');
  });
});
