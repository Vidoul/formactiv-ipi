import { validerEnvironnement } from './environnement';

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://u:p@localhost:5433/db',
  WEB_URL: 'http://localhost:5173',
  CORS_ORIGINS: 'http://localhost:5173, http://localhost:4173',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
  JWT_MFA_SECRET: 'y'.repeat(32),
  MFA_ENCRYPTION_KEY: 'a'.repeat(64),
  DOCUMENT_URL_SECRET: 'z'.repeat(32),
};

describe('validerEnvironnement', () => {
  it('accepte une configuration complète et applique les valeurs par défaut', () => {
    const env = validerEnvironnement(base);
    expect(env.PORT).toBe(3000);
    expect(env.JWT_ACCESS_TTL_SECONDES).toBe(900);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173', 'http://localhost:4173']);
    expect(env.COOKIE_SECURE).toBe(false);
  });

  it('refuse un secret JWT trop court (OWASP A05)', () => {
    expect(() => validerEnvironnement({ ...base, JWT_ACCESS_SECRET: 'court' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('refuse une clé de chiffrement MFA mal formée', () => {
    expect(() => validerEnvironnement({ ...base, MFA_ENCRYPTION_KEY: 'pas-hexa' })).toThrow(
      /MFA_ENCRYPTION_KEY/,
    );
  });

  it('exige des cookies Secure et des secrets régénérés en production', () => {
    expect(() =>
      validerEnvironnement({
        ...base,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'dev-' + 'x'.repeat(40),
        MFA_ENCRYPTION_KEY: '0'.repeat(64),
      }),
    ).toThrow(/COOKIE_SECURE[\s\S]*Secrets de développement/);
  });

  it('exige la configuration S3 lorsque le pilote s3 est choisi', () => {
    expect(() => validerEnvironnement({ ...base, STORAGE_DRIVER: 's3' })).toThrow(/S3_BUCKET/);
  });
});
