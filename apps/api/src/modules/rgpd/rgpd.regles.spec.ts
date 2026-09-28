import { FinaliteConsentement, StatutDemandeRgpd } from '@prisma/client';
import {
  controlerTraitement,
  echeance,
  estCloturee,
  finaliteRevocable,
  numeroDemande,
} from './rgpd.regles';

const { RECUE, EN_COURS, TRAITEE, REFUSEE } = StatutDemandeRgpd;

describe('Règles RGPD (UC-13, UC-14, RG-RGPD-01..04)', () => {
  it('fait suivre le cycle reçue → en cours → traitée / refusée', () => {
    expect(controlerTraitement(RECUE, EN_COURS)).toBeNull();
    expect(controlerTraitement(RECUE, TRAITEE)).toBeNull();
    expect(controlerTraitement(EN_COURS, TRAITEE)).toBeNull();
    expect(controlerTraitement(EN_COURS, RECUE)).toMatch(/Transition impossible/);
    expect(controlerTraitement(TRAITEE, REFUSEE, 'motif')).toBe('Cette demande est clôturée.');
    expect(controlerTraitement(REFUSEE, EN_COURS)).toBe('Cette demande est clôturée.');
  });

  it('exige la motivation d’un refus', () => {
    expect(controlerTraitement(RECUE, REFUSEE)).toBe('Un refus doit être motivé.');
    expect(controlerTraitement(RECUE, REFUSEE, '   ')).toBe('Un refus doit être motivé.');
    expect(controlerTraitement(RECUE, REFUSEE, 'Identité non vérifiée')).toBeNull();
  });

  it('distingue demandes ouvertes et clôturées', () => {
    expect(estCloturee(RECUE)).toBe(false);
    expect(estCloturee(EN_COURS)).toBe(false);
    expect(estCloturee(TRAITEE)).toBe(true);
    expect(numeroDemande(126)).toBe('D-126');
  });

  it('ne rend révocable en libre-service que la finalité satisfaction', () => {
    expect(finaliteRevocable(FinaliteConsentement.QUESTIONNAIRES_SATISFACTION)).toBe(true);
    expect(finaliteRevocable(FinaliteConsentement.GESTION_COMPTE)).toBe(false);
  });

  it('calcule les échéances de conservation (RG-RGPD-04)', () => {
    const maintenant = new Date('2026-09-28T10:00:00Z');
    expect(echeance(maintenant, 12).toISOString()).toBe('2025-09-28T10:00:00.000Z');
    expect(echeance(maintenant, 36).toISOString()).toBe('2023-09-28T10:00:00.000Z');
  });
});
