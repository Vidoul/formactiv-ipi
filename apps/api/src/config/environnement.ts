import { z } from 'zod';

/**
 * Schéma des variables d'environnement, validé au démarrage (fail fast).
 *
 * OWASP A05 (Security Misconfiguration) : une configuration invalide ou un secret trop court
 * empêche l'application de démarrer, plutôt que de tourner dans un état non sûr.
 * Aucun secret n'a de valeur par défaut.
 */
const booleen = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

const listeUrls = z
  .string()
  .min(1)
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

export const schemaEnvironnement = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    TRUST_PROXY: booleen,

    DATABASE_URL: z.string().url(),

    WEB_URL: z.string().url(),
    CORS_ORIGINS: listeUrls,

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit faire au moins 32 caractères'),
    JWT_ACCESS_TTL_SECONDES: z.coerce.number().int().min(60).max(3600).default(900),
    JWT_MFA_SECRET: z.string().min(32, 'JWT_MFA_SECRET doit faire au moins 32 caractères'),
    REFRESH_TOKEN_TTL_JOURS: z.coerce.number().int().min(1).max(30).default(7),
    COOKIE_SECURE: booleen,

    MFA_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-fA-F]{64}$/, 'MFA_ENCRYPTION_KEY doit contenir 64 caractères hexadécimaux'),

    DOCUMENT_URL_SECRET: z.string().min(32),
    DOCUMENT_URL_TTL_SECONDES: z.coerce.number().int().min(30).max(3600).default(300),

    MAIL_TRANSPORT: z.enum(['smtp', 'memoire']).default('smtp'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().positive().default(1025),
    SMTP_SECURE: booleen,
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    MAIL_FROM: z.string().min(3).default('FORMACTIV <no-reply@formactiv.fr>'),

    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./storage'),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().optional(),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),

    PASSWORD_PWNED_CHECK: booleen,
    SWAGGER_ENABLED: booleen,

    // Limitation de débit (OWASP A04/A07) : requêtes par minute et par adresse IP.
    THROTTLE_LIMITE_GLOBALE: z.coerce.number().int().positive().default(300),
    THROTTLE_LIMITE_AUTH: z.coerce.number().int().positive().default(10),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (!env.COOKIE_SECURE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['COOKIE_SECURE'],
          message:
            'COOKIE_SECURE doit valoir true en production (cookies transmis en HTTPS uniquement)',
        });
      }
      if (/^0+$/.test(env.MFA_ENCRYPTION_KEY) || env.JWT_ACCESS_SECRET.startsWith('dev-')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_ACCESS_SECRET'],
          message: 'Secrets de développement détectés : régénérer les secrets de production',
        });
      }
    }
    if (env.STORAGE_DRIVER === 's3' && (!env.S3_BUCKET || !env.S3_ACCESS_KEY_ID)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['S3_BUCKET'],
        message: 'S3_BUCKET et S3_ACCESS_KEY_ID sont requis avec STORAGE_DRIVER=s3',
      });
    }
  });

export type Environnement = z.infer<typeof schemaEnvironnement>;

/** Fonction de validation branchée sur ConfigModule.forRoot({ validate }). */
export function validerEnvironnement(config: Record<string, unknown>): Environnement {
  const resultat = schemaEnvironnement.safeParse(config);
  if (!resultat.success) {
    const erreurs = resultat.error.issues
      .map((i) => `  - ${i.path.join('.')} : ${i.message}`)
      .join('\n');
    throw new Error(`Configuration invalide :\n${erreurs}`);
  }
  return resultat.data;
}
