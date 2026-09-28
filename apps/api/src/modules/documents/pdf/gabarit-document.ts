import { COULEURS, creerPdf, enTeteFormactiv } from './pdf-accessible';

export interface DonneesDocument {
  type: 'ATTESTATION' | 'CERTIFICAT';
  reference: string;
  dateGeneration: Date;
  apprenant: { prenom: string; nom: string };
  formation: { intitule: string; dureeHeures: number; modalite: string };
  session: { dateDebut: string; dateFin: string; lieu: string | null };
  competences: { libelle: string; codeRncp: string | null; acquise: boolean }[];
  emetteur: { prenom: string; nom: string; fonction: string };
}

const MODALITES: Record<string, string> = {
  PRESENTIEL: 'présentiel',
  DISTANCIEL: 'distanciel',
  HYBRIDE: 'hybride',
};

function dateFr(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(`${iso}T00:00:00Z`) : iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(d);
}

/**
 * Attestation de suivi ou certificat de réussite (UC-09). RG-CERT-02 : chaque document porte un
 * identifiant unique, la date de génération et l'identité de l'émetteur.
 */
export function genererDocumentPdf(d: DonneesDocument): Promise<Buffer> {
  const certificat = d.type === 'CERTIFICAT';
  const titre = certificat ? 'Certificat de réussite' : 'Attestation de suivi de formation';
  const nomComplet = `${d.apprenant.prenom} ${d.apprenant.nom.toUpperCase()}`;
  const pdf = creerPdf({
    titre: `${titre} — ${nomComplet} — ${d.reference}`,
    sujet: `${titre} : ${d.formation.intitule}`,
    auteur: 'FORMACTIV',
    motsCles: `${d.reference}, ${d.formation.intitule}`,
    date: d.dateGeneration,
  });
  const { doc } = pdf;
  enTeteFormactiv(pdf);

  pdf.bloc('H1', () => {
    doc
      .font('Helvetica-Bold')
      .fontSize(24)
      .fillColor(COULEURS.bleuNuit)
      .text(titre, { align: 'center' });
  });
  doc.moveDown(1.2);

  const lieu = d.session.lieu ? `, ${d.session.lieu}` : '';
  const texte = certificat
    ? `FORMACTIV certifie que ${nomComplet} a suivi avec succès la formation « ${d.formation.intitule} » (${d.formation.dureeHeures} heures, ${MODALITES[d.formation.modalite] ?? d.formation.modalite}), session du ${dateFr(d.session.dateDebut)} au ${dateFr(d.session.dateFin)}${lieu}, et a acquis l’ensemble des compétences visées.`
    : `FORMACTIV atteste que ${nomComplet} a suivi la formation « ${d.formation.intitule} » (${d.formation.dureeHeures} heures, ${MODALITES[d.formation.modalite] ?? d.formation.modalite}), session du ${dateFr(d.session.dateDebut)} au ${dateFr(d.session.dateFin)}${lieu}.`;
  pdf.bloc('P', () => {
    doc
      .font('Helvetica')
      .fontSize(12)
      .fillColor(COULEURS.texte)
      .text(texte, { align: 'justify', lineGap: 3 });
  });
  doc.moveDown(1);

  if (d.competences.length > 0) {
    pdf.bloc('H2', () => {
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(COULEURS.bleuNuit)
        .text(certificat ? 'Compétences acquises' : 'Compétences évaluées');
    });
    doc.moveDown(0.4);
    const liste = doc.struct('L');
    pdf.racine.add(liste);
    for (const c of d.competences) {
      const code = c.codeRncp ? ` (${c.codeRncp})` : '';
      const etat = certificat ? '' : c.acquise ? ' — acquise' : ' — en cours d’acquisition';
      liste.add(
        doc.struct('LI', {}, () => {
          doc
            .font('Helvetica')
            .fontSize(11)
            .fillColor(COULEURS.texte)
            .text(`•  ${c.libelle}${code}${etat}`, { indent: 12 });
        }),
      );
    }
    liste.end();
    doc.moveDown(1.5);
  }

  pdf.decor(() => {
    const y = doc.y;
    doc.save();
    doc
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .strokeColor(COULEURS.trait)
      .stroke();
    doc.restore();
  });
  doc.moveDown(0.8);

  pdf.bloc('P', () => {
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COULEURS.gris)
      .text(`Référence du document : ${d.reference}`)
      .text(
        `Généré le ${dateFr(d.dateGeneration)} par ${d.emetteur.prenom} ${d.emetteur.nom}, ${d.emetteur.fonction}.`,
      )
      .text('Ce document est conservé dans l’historique du parcours de formation (RG-HIST-01).');
  });

  return pdf.terminer();
}
