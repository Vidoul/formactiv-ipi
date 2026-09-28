import PDFDocument from 'pdfkit';

/**
 * Fabrique de PDF accessibles (engagement RGAA du chapitre 11 : « documents PDF générés balisés
 * et lisibles par lecteur d'écran ») :
 * - PDF 1.7 balisé (arbre de structure : titres, paragraphes, listes, tableaux) ;
 * - langue du document (fr-FR) et titre affiché à l'ouverture ;
 * - éléments purement décoratifs marqués comme « artefacts » (ignorés par les lecteurs d'écran) ;
 * - polices standard (aucune ressource externe chargée).
 */
export interface MetadonneesPdf {
  titre: string;
  sujet: string;
  auteur: string;
  motsCles?: string;
  /** Date de création inscrite dans les métadonnées (par défaut : maintenant). */
  date?: Date;
}

export interface PdfEnConstruction {
  doc: PDFKit.PDFDocument;
  racine: PDFKit.PDFStructureElement;
  /** Ajoute un élément de structure contenant du texte (H1, H2, P, LI…). */
  bloc(type: string, dessin: () => void): PDFKit.PDFStructureElement;
  /** Contenu décoratif, exclu de l'arbre de structure. */
  decor(dessin: () => void): void;
  terminer(): Promise<Buffer>;
}

export const COULEURS = {
  bleuNuit: '#1b3565',
  bleu: '#2b4c8c',
  texte: '#1f2937',
  gris: '#4b5563',
  trait: '#d9dee7',
} as const;

export function creerPdf(
  meta: MetadonneesPdf,
  options: { paysage?: boolean } = {},
): PdfEnConstruction {
  const doc = new PDFDocument({
    size: 'A4',
    layout: options.paysage ? 'landscape' : 'portrait',
    margins: { top: 64, bottom: 56, left: 56, right: 56 },
    pdfVersion: '1.7',
    tagged: true,
    lang: 'fr-FR',
    displayTitle: true,
    bufferPages: true,
    info: {
      Title: meta.titre,
      Subject: meta.sujet,
      Author: meta.auteur,
      // pdfkit n'accepte pas de valeur indéfinie dans le dictionnaire Info.
      ...(meta.motsCles ? { Keywords: meta.motsCles } : {}),
      Creator: 'FORMACTIV',
      Producer: 'FORMACTIV',
      CreationDate: meta.date ?? new Date(),
    },
  });
  const morceaux: Buffer[] = [];
  const fin = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (m: Buffer) => morceaux.push(m));
    doc.on('end', () => resolve(Buffer.concat(morceaux)));
    doc.on('error', reject);
  });

  const racine = doc.struct('Document');
  doc.addStructure(racine);

  return {
    doc,
    racine,
    bloc(type, dessin) {
      const element = doc.struct(type, {}, dessin);
      racine.add(element);
      return element;
    },
    decor(dessin) {
      doc.markContent('Artifact', { type: 'Layout' });
      dessin();
      doc.endMarkedContent();
    },
    terminer() {
      racine.end();
      doc.end();
      return fin;
    },
  };
}

/** Bandeau d'en-tête commun (décoratif) et nom de l'organisme (contenu). */
export function enTeteFormactiv(pdf: PdfEnConstruction): void {
  const { doc } = pdf;
  pdf.decor(() => {
    doc.save();
    doc.rect(0, 0, doc.page.width, 36).fill(COULEURS.bleuNuit);
    doc.restore();
  });
  pdf.bloc('P', () => {
    doc
      .font('Helvetica-Bold')
      .fontSize(16)
      .fillColor(COULEURS.bleuNuit)
      .text('FORMACTIV', doc.page.margins.left, 52, { continued: true })
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COULEURS.gris)
      .text('   Organisme de formation professionnelle — Occitanie');
  });
  doc.moveDown(2);
}
