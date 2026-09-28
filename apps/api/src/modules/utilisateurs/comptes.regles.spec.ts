import { CodeRole } from '@prisma/client';
import {
  controlerRattachement,
  doitEtreAnonymise,
  emailAnonyme,
  peutGererCompte,
} from './comptes.regles';

describe('Règles de gestion des comptes (UC-03)', () => {
  describe('rattachement à une entreprise (H2, REQ-FUNC-018)', () => {
    it('exige une entreprise pour un client entreprise', () => {
      expect(controlerRattachement(CodeRole.CLIENT_ENTREPRISE, null)).toMatch(/doit être rattaché/);
      expect(controlerRattachement(CodeRole.CLIENT_ENTREPRISE, 'e1')).toBeNull();
    });

    it('rend le rattachement facultatif pour un apprenant', () => {
      expect(controlerRattachement(CodeRole.APPRENANT, null)).toBeNull();
      expect(controlerRattachement(CodeRole.APPRENANT, 'e1')).toBeNull();
    });

    it("interdit le rattachement du personnel de l'organisme", () => {
      for (const role of [CodeRole.ADMIN, CodeRole.RESP_FORMATION, CodeRole.FORMATEUR]) {
        expect(controlerRattachement(role, 'e1')).not.toBeNull();
      }
    });
  });

  describe('droits de gestion (matrice RBAC)', () => {
    it("autorise l'administrateur sur tous les comptes", () => {
      expect(peutGererCompte(CodeRole.ADMIN, CodeRole.ADMIN, CodeRole.APPRENANT)).toBe(true);
    });

    it('limite le responsable formation aux comptes non administrateurs', () => {
      expect(peutGererCompte(CodeRole.RESP_FORMATION, null, CodeRole.FORMATEUR)).toBe(true);
      expect(peutGererCompte(CodeRole.RESP_FORMATION, CodeRole.ADMIN)).toBe(false);
      expect(peutGererCompte(CodeRole.RESP_FORMATION, CodeRole.APPRENANT, CodeRole.ADMIN)).toBe(
        false,
      );
    });

    it('refuse les autres profils', () => {
      expect(peutGererCompte(CodeRole.FORMATEUR, CodeRole.APPRENANT)).toBe(false);
    });
  });

  describe('RG-CPT-02 — suppression ou anonymisation', () => {
    const vide = {
      inscriptions: 0,
      animations: 0,
      evaluationsSaisies: 0,
      documentsEmis: 0,
      actionsJournalisees: 0,
      demandesRgpd: 0,
    };

    it('supprime physiquement un compte sans historique', () => {
      expect(doitEtreAnonymise(vide)).toBe(false);
    });

    it('anonymise un compte ayant un historique de formation ou des actions tracées', () => {
      expect(doitEtreAnonymise({ ...vide, inscriptions: 1 })).toBe(true);
      expect(doitEtreAnonymise({ ...vide, actionsJournalisees: 3 })).toBe(true);
    });

    it('génère une adresse de substitution non routable', () => {
      expect(emailAnonyme('abc')).toBe('anonyme-abc@anonymise.invalid');
    });
  });
});
