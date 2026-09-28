# syntax=docker/dockerfile:1.7
# Image du front FORMACTIV : application construite, servie par Nginx non privilégié qui relaie
# /api vers l'API (même origine : cookie de refresh SameSite=Strict, pas de CORS en production).
#   docker build -f apps/web/Dockerfile -t formactiv-web .

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS construction
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY e2e/package.json e2e/package.json
RUN npm ci --workspace @formactiv/web --include-workspace-root=false --ignore-scripts
COPY apps/web apps/web
RUN npm run build -w @formactiv/web

FROM nginxinc/nginx-unprivileged:1.29-alpine AS execution
# Adresse de l'API (service Docker) injectée dans la configuration au démarrage (envsubst).
ENV API_UPSTREAM=http://api:3000
COPY apps/web/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY apps/web/nginx/securite.conf /etc/nginx/snippets/securite.conf
COPY --from=construction /app/apps/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ > /dev/null || exit 1
