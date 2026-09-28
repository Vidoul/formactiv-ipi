import { genererDocumentPdf, type DonneesDocument } from './gabarit-document';
import { genererTableauPdf } from './gabarit-tableau';

const document: DonneesDocument = {
  type: 'CERTIFICAT',
  reference: 'C-2026-0412',
  dateGeneration: new Date('2026-09-19T08:30:00Z'),
  apprenant: { prenom: 'Léa', nom: 'Martin' },
  formation: { intitule: 'Cybersécurité fondamentaux', dureeHeures: 35, modalite: 'PRESENTIEL' },
  session: { dateDebut: '2026-09-14', dateFin: '2026-09-18', lieu: 'Toulouse' },
  competences: [
    { libelle: 'Sécuriser un SI', codeRncp: 'RNCP35-C1', acquise: true },
    { libelle: 'Analyser les risques', codeRncp: null, acquise: true },
  ],
  emetteur: { prenom: 'Nadia', nom: 'Rey', fonction: 'Responsable formation' },
};

/** Motifs de l'arbre de structure PDF (dictionnaires non compressés). */
function structure(pdf: Buffer): string {
  return pdf.toString('latin1');
}

describe('PDF accessibles (RGAA, chapitre 11)', () => {
  it('génère un certificat PDF 1.7 balisé, en français, avec titre affiché', async () => {
    const pdf = await genererDocumentPdf(document);
    const texte = structure(pdf);
    expect(texte.startsWith('%PDF-1.7')).toBe(true);
    expect(texte).toContain('/StructTreeRoot');
    expect(texte).toContain('/MarkInfo');
    expect(texte).toContain('/Marked true');
    expect(texte).toContain('/Lang (fr-FR)');
    expect(texte).toMatch(/\/DisplayDocTitle true/);
    for (const balise of ['/S /Document', '/S /H1', '/S /H2', '/S /P', '/S /L', '/S /LI']) {
      expect(texte).toContain(balise);
    }
  });

  it('génère une attestation sans compétence', async () => {
    const pdf = await genererDocumentPdf({ ...document, type: 'ATTESTATION', competences: [] });
    expect(structure(pdf)).not.toContain('/S /L\n');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('balise les exports tabulaires (Table / TR / TH / TD) et pagine les longs tableaux', async () => {
    const lignes = Array.from({ length: 120 }, (_, i) => [`Apprenant ${i}`, `${i % 20}`]);
    const pdf = await genererTableauPdf({
      titre: 'Export — Résultats',
      sousTitre: 'Essai',
      colonnes: [
        { entete: 'Apprenant', largeur: 3 },
        { entete: 'Note', largeur: 1 },
      ],
      lignes,
    });
    const texte = structure(pdf);
    for (const balise of ['/S /Table', '/S /TR', '/S /TH', '/S /TD']) {
      expect(texte).toContain(balise);
    }
    expect((texte.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });
});
