# syntax=docker/dockerfile:1.7
# Image de l'API FORMACTIV (chapitre 12 : conteneurisation DEV/TEST/PROD).
# Construite depuis la racine du dépôt (espaces de travail npm, verrou de dépendances commun) :
#   docker build -f apps/api/Dockerfile -t formactiv-api .

ARG NODE_VERSION=24-alpine

# --- Dépendances complètes (construction, migrations, jeu de données initial) -----------------
FROM node:${NODE_VERSION} AS dependances
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY e2e/package.json e2e/package.json
# Scripts d'installation nécessaires (moteurs Prisma, argon2). Le script « prepare » de la racine
# (hooks Git Husky) est retiré : npm l'exécute même avec --include-workspace-root=false, alors que
# les outils de la racine ne sont pas installés dans l'image.
RUN npm pkg delete scripts.prepare \
  && npm ci --workspace @formactiv/api --include-workspace-root=false

# --- Construction ------------------------------------------------------------------------------
FROM dependances AS construction
COPY apps/api apps/api
WORKDIR /app/apps/api
RUN npx prisma generate && npm run build

# --- Dépendances de production uniquement ------------------------------------------------------
FROM node:${NODE_VERSION} AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY e2e/package.json e2e/package.json
RUN npm ci --workspace @formactiv/api --include-workspace-root=false --omit=dev --ignore-scripts \
  && npm cache clean --force \
  && mkdir -p apps/api/node_modules
# Client Prisma généré pour la plateforme de l'image (musl + OpenSSL 3).
COPY --from=construction /app/node_modules/.prisma /app/node_modules/.prisma

# --- Exécution ---------------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS execution
ENV NODE_ENV=production
WORKDIR /app/apps/api
RUN apk add --no-cache openssl tini && mkdir -p /app/apps/api/storage && chown node:node /app/apps/api/storage
COPY --from=production-deps --chown=node:node /app/node_modules /app/node_modules
# Dépendances non remontées à la racine (versions en conflit), s'il y en a.
COPY --from=production-deps --chown=node:node /app/apps/api/node_modules ./node_modules
COPY --from=construction --chown=node:node /app/apps/api/dist ./dist
COPY --chown=node:node apps/api/package.json ./package.json
# Utilisateur non privilégié (défense en profondeur).
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/v1/sante > /dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
