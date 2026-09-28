/**
 * Contrôle de validité d'un numéro SIRET : 14 chiffres dont la clé de Luhn est correcte.
 * (Le SIRET est facultatif — [À VALIDER] au dictionnaire de données.)
 */
export function siretValide(siret: string): boolean {
  if (!/^\d{14}$/.test(siret)) return false;
  let somme = 0;
  for (let i = 0; i < 14; i++) {
    let chiffre = Number(siret[i]);
    if (i % 2 === 0) {
      chiffre *= 2;
      if (chiffre > 9) chiffre -= 9;
    }
    somme += chiffre;
  }
  return somme % 10 === 0;
}
