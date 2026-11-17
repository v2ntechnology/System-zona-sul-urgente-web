# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# Variáveis lidas no build (NEXT_PUBLIC_* ficam embutidas no código do navegador). Com API_URL, o build busca as
# notícias na API, que precisa estar no ar (ver infra/compose.prod.yaml). Vazias = dados de exemplo.
ARG API_URL=
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_SITE_ENV=
ARG NEXT_PUBLIC_WHATSAPP_URL=
ARG NEXT_PUBLIC_REPORT_WHATSAPP_URL=
ARG NEXT_PUBLIC_ADSENSE_CLIENT=
ENV API_URL=$API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SITE_ENV=$NEXT_PUBLIC_SITE_ENV \
    NEXT_PUBLIC_WHATSAPP_URL=$NEXT_PUBLIC_WHATSAPP_URL \
    NEXT_PUBLIC_REPORT_WHATSAPP_URL=$NEXT_PUBLIC_REPORT_WHATSAPP_URL \
    NEXT_PUBLIC_ADSENSE_CLIENT=$NEXT_PUBLIC_ADSENSE_CLIENT
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
