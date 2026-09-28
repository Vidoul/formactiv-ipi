import { COULEURS, creerPdf, enTeteFormactiv } from './pdf-accessible';

export interface DonneesTableauPdf {
  titre: string;
  sousTitre: string;
  colonnes: { entete: string; largeur: number }[];
  lignes: string[][];
}

/**
 * Export PDF tabulaire (UC-11) : tableau balisé (Table / TR / TH / TD), en-têtes répétés à
 * chaque page, mise en page paysage pour les exports larges.
 */
export function genererTableauPdf(d: DonneesTableauPdf): Promise<Buffer> {
  const pdf = creerPdf(
    { titre: d.titre, sujet: d.sousTitre, auteur: 'FORMACTIV' },
    { paysage: true },
  );
  const { doc } = pdf;
  enTeteFormactiv(pdf);
  pdf.bloc('H1', () => {
    doc.font('Helvetica-Bold').fontSize(18).fillColor(COULEURS.bleuNuit).text(d.titre);
  });
  pdf.bloc('P', () => {
    doc.font('Helvetica').fontSize(10).fillColor(COULEURS.gris).text(d.sousTitre);
  });
  doc.moveDown(1);

  const gauche = doc.page.margins.left;
  const largeurUtile = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const total = d.colonnes.reduce((s, c) => s + c.largeur, 0);
  const largeurs = d.colonnes.map((c) => (c.largeur / total) * largeurUtile);
  const bas = () => doc.page.height - doc.page.margins.bottom;

  const tableau = doc.struct('Table');
  pdf.racine.add(tableau);

  const ecrireLigne = (cellules: string[], entete: boolean) => {
    doc.font(entete ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    const hauteur =
      Math.max(
        ...cellules.map((texte, i) => doc.heightOfString(texte || ' ', { width: largeurs[i] - 8 })),
      ) + 8;
    if (doc.y + hauteur > bas()) {
      doc.addPage();
      doc.y = doc.page.margins.top;
      if (!entete)
        ecrireLigne(
          d.colonnes.map((c) => c.entete),
          true,
        );
      doc.font(entete ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    }
    const y = doc.y;
    if (entete) {
      pdf.decor(() => {
        doc.save();
        doc.rect(gauche, y, largeurUtile, hauteur).fill('#e5eefc');
        doc.restore();
      });
    }
    const ligne = doc.struct('TR');
    tableau.add(ligne);
    let x = gauche;
    cellules.forEach((texte, i) => {
      const xCellule = x;
      ligne.add(
        doc.struct(entete ? 'TH' : 'TD', {}, () => {
          doc
            .font(entete ? 'Helvetica-Bold' : 'Helvetica')
            .fontSize(9)
            .fillColor(entete ? COULEURS.bleuNuit : COULEURS.texte)
            .text(texte || '—', xCellule + 4, y + 4, { width: largeurs[i] - 8 });
        }),
      );
      x += largeurs[i];
    });
    ligne.end();
    pdf.decor(() => {
      doc.save();
      doc
        .moveTo(gauche, y + hauteur)
        .lineTo(gauche + largeurUtile, y + hauteur)
        .strokeColor(COULEURS.trait)
        .stroke();
      doc.restore();
    });
    doc.x = gauche;
    doc.y = y + hauteur;
  };

  ecrireLigne(
    d.colonnes.map((c) => c.entete),
    true,
  );
  if (d.lignes.length === 0) ecrireLigne(['Aucune donnée pour ces critères.'], false);
  for (const l of d.lignes) ecrireLigne(l, false);
  tableau.end();
  return pdf.terminer();
}
