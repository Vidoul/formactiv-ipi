import { StatutCompte } from '@prisma/client';

/**
 * RG-AUTH-02 — Après N tentatives de connexion échouées (5 par défaut), le compte est
 * temporairement verrouillé (15 min par défaut) et l'événement est journalisé.
 */
export interface EtatConnexion {
  statutCompte: StatutCompte;
  tentativesEchouees: number;
  verrouilleJusquA: Date | null;
}

export interface ReglesVerrouillage {
  tentativesMax: number;
  dureeMinutes: number;
}

/** Le compte est-il actuellement verrouillé ? */
export function estVerrouille(etat: EtatConnexion, maintenant: Date): boolean {
  return (
    etat.statutCompte === StatutCompte.VERROUILLE &&
    etat.verrouilleJusquA !== null &&
    etat.verrouilleJusquA > maintenant
  );
}

/** Minutes restantes avant déverrouillage automatique (arrondi supérieur). */
export function minutesRestantes(etat: EtatConnexion, maintenant: Date): number {
  if (!etat.verrouilleJusquA) return 0;
  return Math.max(0, Math.ceil((etat.verrouilleJusquA.getTime() - maintenant.getTime()) / 60_000));
}

/** Nouvel état après un échec d'authentification (mot de passe ou code MFA). */
export function apresEchec(
  etat: EtatConnexion,
  regles: ReglesVerrouillage,
  maintenant: Date,
): EtatConnexion & { vientDEtreVerrouille: boolean } {
  // Un verrouillage échu est levé avant de compter le nouvel échec.
  const base = etatApresExpiration(etat, maintenant);
  const tentatives = base.tentativesEchouees + 1;
  if (tentatives >= regles.tentativesMax) {
    return {
      statutCompte: StatutCompte.VERROUILLE,
      tentativesEchouees: tentatives,
      verrouilleJusquA: new Date(maintenant.getTime() + regles.dureeMinutes * 60_000),
      vientDEtreVerrouille: true,
    };
  }
  return { ...base, tentativesEchouees: tentatives, vientDEtreVerrouille: false };
}

/** État après une authentification réussie : compteur remis à zéro. */
export function apresSucces(etat: EtatConnexion): EtatConnexion {
  return {
    statutCompte:
      etat.statutCompte === StatutCompte.VERROUILLE ? StatutCompte.ACTIF : etat.statutCompte,
    tentativesEchouees: 0,
    verrouilleJusquA: null,
  };
}

/** Lève un verrouillage dont la durée est écoulée. */
export function etatApresExpiration(etat: EtatConnexion, maintenant: Date): EtatConnexion {
  if (etat.statutCompte === StatutCompte.VERROUILLE && !estVerrouille(etat, maintenant)) {
    return { statutCompte: StatutCompte.ACTIF, tentativesEchouees: 0, verrouilleJusquA: null };
  }
  return etat;
}
