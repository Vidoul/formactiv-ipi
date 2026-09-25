import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { middlewareContexteRequete } from './common/context/contexte-requete';
import type { Environnement } from './config/environnement';

export const PREFIXE_API = 'api/v1';

/**
 * Configuration HTTP transverse, partagée par `main.ts` et les tests d'intégration pour que
 * ceux-ci s'exécutent dans les mêmes conditions que la production.
 */
export function configurerApplication(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Environnement, true>>(ConfigService);

  // Adresse IP réelle derrière le reverse proxy de l'hébergeur (journal, limitation de débit).
  app.set('trust proxy', config.get('TRUST_PROXY', { infer: true }) ? 1 : false);
  app.disable('x-powered-by');

  // OWASP A05 : en-têtes de sécurité (CSP, HSTS, X-Content-Type-Options, frame-ancestors…).
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // requis par l'interface Swagger UI
          imgSrc: ["'self'", 'data:'],
          frameAncestors: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      hsts: { maxAge: 31_536_000, includeSubDomains: true },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(cookieParser());
  app.use(middlewareContexteRequete);

  // Limite de taille des corps de requête (déni de service applicatif).
  app.useBodyParser('json', { limit: '100kb' });

  // CORS restreint à l'origine du front ; cookies autorisés pour le refresh token.
  app.enableCors({
    origin: config.get('CORS_ORIGINS', { infer: true }),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Disposition', 'X-Request-Id'],
    maxAge: 600,
  });

  app.setGlobalPrefix(PREFIXE_API);
  app.enableShutdownHooks();

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    SwaggerModule.setup('api/docs', app, creerDocumentOpenApi(app), {
      jsonDocumentUrl: 'api/docs-json',
      yamlDocumentUrl: 'api/docs-yaml',
      customSiteTitle: 'FORMACTIV — API',
    });
  }
}

/** Spécification OpenAPI générée depuis le code (toujours synchrone, chapitre 9). */
export function creerDocumentOpenApi(app: INestApplication): OpenAPIObject {
  const options = new DocumentBuilder()
    .setTitle('FORMACTIV — API REST')
    .setDescription(
      [
        'API de la plateforme de gestion des formations et des compétences FORMACTIV.',
        '',
        '- Versionnée sous `/api/v1` (ADR-01), réponses JSON, pagination `page` / `limit`.',
        '- Authentification : jeton **Bearer** (access token 15 min) ; refresh token en cookie `httpOnly`.',
        '- Contrôle d’accès par rôle (matrice RBAC du chapitre 5), refus par défaut.',
        '- Erreurs normalisées `{ statusCode, code, message, details }` : 400 validation, 401, 403, 404, 409 règle de gestion, 423 compte verrouillé.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'jwt')
    .addCookieAuth('formactiv_refresh', { type: 'apiKey', in: 'cookie' }, 'refresh')
    .build();
  return SwaggerModule.createDocument(app, options);
}
