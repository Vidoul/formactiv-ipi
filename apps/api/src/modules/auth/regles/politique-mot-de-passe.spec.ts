import { verifierPolitique } from './politique-mot-de-passe';

describe('RG-AUTH-01 — politique de mot de passe fort', () => {
  it('accepte un mot de passe conforme', () => {
    expect(verifierPolitique('Formation#Toulouse26')).toEqual([]);
    expect(verifierPolitique('Tr0mpette!Verte-Soir')).toEqual([]);
  });

  it.each([
    ['Court1!a', 'TROP_COURT'],
    ['sansmajuscule123!', 'MAJUSCULE_MANQUANTE'],
    ['SANSMINUSCULE123!', 'MINUSCULE_MANQUANTE'],
    ['SansChiffreIci!!', 'CHIFFRE_MANQUANT'],
    ['SansSpecial12345', 'SPECIAL_MANQUANT'],
  ])('refuse « %s » (%s)', (motDePasse, erreur) => {
    expect(verifierPolitique(motDePasse)).toContain(erreur);
  });

  it('refuse les mots de passe trop longs (protection contre le déni de service)', () => {
    expect(verifierPolitique(`Aa1!${'x'.repeat(130)}`)).toContain('TROP_LONG');
  });

  it.each(['Password123!', 'Azerty123456!', 'MotDePasse2026!', '!!Formactiv2026', 'Bonjour12345@'])(
    'refuse le mot de passe prévisible « %s » malgré sa complexité apparente',
    (motDePasse) => {
      expect(verifierPolitique(motDePasse)).toContain('TROP_PREVISIBLE');
    },
  );

  it("refuse un mot de passe contenant l'identité de l'utilisateur", () => {
    const identite = { nom: 'Martin', prenom: 'Léa', email: 'lea.martin@mail.fr' };
    expect(verifierPolitique('Martin#Formation26', identite)).toContain('CONTIENT_IDENTITE');
    expect(verifierPolitique('LEA.MARTIN-2026!x', identite)).toContain('CONTIENT_IDENTITE');
    expect(verifierPolitique('Tr0mpette!Verte-Soir', identite)).toEqual([]);
  });
});
