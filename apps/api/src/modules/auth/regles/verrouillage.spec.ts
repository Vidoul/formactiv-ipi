import { StatutCompte } from '@prisma/client';
import {
  apresEchec,
  apresSucces,
  estVerrouille,
  etatApresExpiration,
  minutesRestantes,
  type EtatConnexion,
} from './verrouillage';

const REGLES = { tentativesMax: 5, dureeMinutes: 15 };
const T0 = new Date('2026-09-25T10:00:00Z');
const actif: EtatConnexion = {
  statutCompte: StatutCompte.ACTIF,
  tentativesEchouees: 0,
  verrouilleJusquA: null,
};

describe('RG-AUTH-02 — verrouillage temporaire', () => {
  it('verrouille le compte 15 minutes au 5e échec consécutif', () => {
    let etat: EtatConnexion = actif;
    for (let i = 1; i <= 4; i++) {
      const r = apresEchec(etat, REGLES, T0);
      expect(r.vientDEtreVerrouille).toBe(false);
      expect(r.statutCompte).toBe(StatutCompte.ACTIF);
      etat = r;
    }
    const cinquieme = apresEchec(etat, REGLES, T0);
    expect(cinquieme.vientDEtreVerrouille).toBe(true);
    expect(cinquieme.statutCompte).toBe(StatutCompte.VERROUILLE);
    expect(cinquieme.verrouilleJusquA).toEqual(new Date('2026-09-25T10:15:00Z'));
    expect(estVerrouille(cinquieme, T0)).toBe(true);
    expect(minutesRestantes(cinquieme, new Date('2026-09-25T10:05:30Z'))).toBe(10);
  });

  it('lève automatiquement le verrouillage une fois la durée écoulée', () => {
    const verrouille = apresEchec({ ...actif, tentativesEchouees: 4 }, REGLES, T0);
    const apres = new Date('2026-09-25T10:15:01Z');
    expect(estVerrouille(verrouille, apres)).toBe(false);
    expect(etatApresExpiration(verrouille, apres)).toEqual(actif);
    // Le premier échec après expiration repart de zéro.
    expect(apresEchec(verrouille, REGLES, apres).tentativesEchouees).toBe(1);
  });

  it('remet le compteur à zéro après une connexion réussie', () => {
    expect(apresSucces({ ...actif, tentativesEchouees: 3 })).toEqual(actif);
  });

  it("respecte un seuil paramétré différemment par l'administrateur", () => {
    const r = apresEchec(
      { ...actif, tentativesEchouees: 2 },
      { tentativesMax: 3, dureeMinutes: 30 },
      T0,
    );
    expect(r.vientDEtreVerrouille).toBe(true);
    expect(r.verrouilleJusquA).toEqual(new Date('2026-09-25T10:30:00Z'));
  });
});
