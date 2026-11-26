# Tavolata in Docker: due immagini dallo stesso file.
#   web     il sito (export web di Expo) servito da nginx
#   server  il server delle stanze (Colyseus) sulla porta 2567
# Le avvia docker-compose.yml; il modo semplice è ./hosta.sh.

# ---------- dipendenze di tutto il progetto, per costruire il sito ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/app/package.json apps/app/
COPY packages/engine/package.json packages/engine/
COPY server/package.json server/
RUN npm ci --no-audit --no-fund

# ---------- il sito ----------
FROM deps AS build-web
COPY . .
# Vuoti di proposito: il sito cerca il server delle stanze sullo stesso computer da cui è aperto
# (porta 2567) e il QR usa l'indirizzo del sito. Si fissano solo dietro un dominio o un proxy.
ARG EXPO_PUBLIC_SERVER_URL=
ARG EXPO_PUBLIC_WEB_URL=
ENV EXPO_PUBLIC_SERVER_URL=${EXPO_PUBLIC_SERVER_URL} EXPO_PUBLIC_WEB_URL=${EXPO_PUBLIC_WEB_URL} CI=1 EXPO_NO_TELEMETRY=1
RUN cd apps/app && npx expo export --platform web --output-dir /out

FROM nginx:1.27-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build-web /out /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

# ---------- il server delle stanze: solo le dipendenze che gli servono ----------
FROM node:22-bookworm-slim AS server-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/app/package.json apps/app/
COPY packages/engine/package.json packages/engine/
COPY server/package.json server/
RUN npm ci --no-audit --no-fund --include=dev --workspace server --workspace packages/engine --include-workspace-root

FROM node:22-bookworm-slim AS server
WORKDIR /app
ENV NODE_ENV=production PORT=2567
# Tutto quello che ha installato npm, anche server/node_modules: alcuni pacchetti di Colyseus stanno lì, non in cima.
COPY --from=server-deps /app ./
COPY packages/engine packages/engine
COPY server server
USER node
EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD node -e "fetch('http://127.0.0.1:2567/').then(()=>process.exit(0),()=>process.exit(1))"
CMD ["node_modules/.bin/tsx", "server/src/index.ts"]
