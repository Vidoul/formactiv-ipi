/**
 * Retour immédiat sur la politique RG-AUTH-01 pendant la saisie. Indicatif uniquement : la
 * vérification qui fait foi (liste de mots de passe compromis, identité) est réalisée par l'API.
 */
export interface CriterePolitique {
  libelle: string;
  respecte: boolean;
}

export function criteresMotDePasse(motDePasse: string): CriterePolitique[] {
  return [
    { libelle: '12 caractères minimum', respecte: motDePasse.length >= 12 },
    { libelle: 'une majuscule', respecte: /\p{Lu}/u.test(motDePasse) },
    { libelle: 'une minuscule', respecte: /\p{Ll}/u.test(motDePasse) },
    { libelle: 'un chiffre', respecte: /\d/.test(motDePasse) },
    { libelle: 'un caractère spécial', respecte: /[^\p{L}\d]/u.test(motDePasse) },
  ];
}

export function motDePasseConforme(motDePasse: string): boolean {
  return criteresMotDePasse(motDePasse).every((c) => c.respecte);
}

export const INDICE_POLITIQUE =
  '12 caractères minimum, majuscules, minuscules, chiffres et caractères spéciaux.';
