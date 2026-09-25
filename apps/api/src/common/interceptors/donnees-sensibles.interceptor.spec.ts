import { retirerChampsSensibles } from './donnees-sensibles.interceptor';

describe('retirerChampsSensibles', () => {
  it('retire les champs sensibles à tous les niveaux', () => {
    const resultat = retirerChampsSensibles({
      donnees: [
        {
          id: '1',
          email: 'a@b.fr',
          motDePasseHash: '$argon2id$...',
          mfaSecretChiffre: 'xxx',
          role: { code: 'ADMIN' },
        },
      ],
      jeton: { empreinte: 'abc', dateExpiration: '2026-01-01' },
    });
    expect(resultat).toEqual({
      donnees: [{ id: '1', email: 'a@b.fr', role: { code: 'ADMIN' } }],
      jeton: { dateExpiration: '2026-01-01' },
    });
  });

  it('laisse intacts les objets non simples (dates, tampons)', () => {
    const date = new Date('2026-09-25T10:00:00Z');
    const tampon = Buffer.from('pdf');
    expect(retirerChampsSensibles({ date, tampon })).toEqual({ date, tampon });
    expect(retirerChampsSensibles(null)).toBeNull();
    expect(retirerChampsSensibles('texte')).toBe('texte');
  });
});
