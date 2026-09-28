import { StatutInscription, TypeDocument } from '@prisma/client';
import {
  documentPropose,
  fonctionEmetteur,
  formaterReference,
  MOTIF_REFERENCE,
  motifRefus,
  typesGenerables,
} from './documents.regles';

const etat = (statut: StatutInscription, acquises: number, visees = 4) => ({
  statut,
  competencesVisees: visees,
  competencesAcquises: acquises,
});

describe('Règles des documents (RG-CERT-01/02)', () => {
  it('aucun document tant que l’inscription n’est pas terminée', () => {
    for (const statut of [
      StatutInscription.EN_ATTENTE,
      StatutInscription.VALIDEE,
      StatutInscription.ANNULEE,
    ]) {
      expect(typesGenerables(etat(statut, 4))).toEqual([]);
      expect(documentPropose(etat(statut, 4))).toBeNull();
      expect(motifRefus(TypeDocument.ATTESTATION, etat(statut, 4))).toMatch(/terminée/);
    }
  });

  it('attestation seule si toutes les compétences ne sont pas acquises (UC-09 A1)', () => {
    const e = etat(StatutInscription.TERMINEE, 3);
    expect(typesGenerables(e)).toEqual([TypeDocument.ATTESTATION]);
    expect(documentPropose(e)).toBe(TypeDocument.ATTESTATION);
    expect(motifRefus(TypeDocument.CERTIFICAT, e)).toMatch(/3 compétence\(s\) acquise\(s\) sur 4/);
    expect(motifRefus(TypeDocument.ATTESTATION, e)).toBeNull();
  });

  it('certificat proposé lorsque toutes les compétences sont acquises', () => {
    const e = etat(StatutInscription.TERMINEE, 4);
    expect(typesGenerables(e)).toEqual([TypeDocument.CERTIFICAT, TypeDocument.ATTESTATION]);
    expect(documentPropose(e)).toBe(TypeDocument.CERTIFICAT);
    expect(motifRefus(TypeDocument.CERTIFICAT, e)).toBeNull();
  });

  it('pas de certificat pour une formation sans compétence visée', () => {
    expect(typesGenerables(etat(StatutInscription.TERMINEE, 0, 0))).toEqual([
      TypeDocument.ATTESTATION,
    ]);
  });

  it('formate une référence unique lisible par type et par année', () => {
    expect(formaterReference(TypeDocument.CERTIFICAT, 2026, 412)).toBe('C-2026-0412');
    expect(formaterReference(TypeDocument.ATTESTATION, 2025, 1188)).toBe('A-2025-1188');
    expect(formaterReference(TypeDocument.ATTESTATION, 2026, 12345)).toBe('A-2026-12345');
    expect(MOTIF_REFERENCE.test('C-2026-0412')).toBe(true);
    expect(() => formaterReference(TypeDocument.CERTIFICAT, 2026, 0)).toThrow();
  });

  it('imprime la fonction de l’émetteur', () => {
    expect(fonctionEmetteur('RESP_FORMATION')).toBe('Responsable formation');
    expect(fonctionEmetteur('ADMIN')).toBe('Administrateur');
  });
});
