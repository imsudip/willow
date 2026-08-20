# Willow — single container: built PWA + API
FROM node:22-alpine AS base
RUN apk add --no-cache gcompat python3 make g++

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --include=dev

FROM deps AS build
WORKDIR /app
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
RUN npm run build -w @willow/shared \
  && npm run build -w @willow/web \
  && npm run build -w @willow/api \
  && npm prune --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S willow && adduser -S willow -G willow
COPY --from=build --chown=willow:willow /app/node_modules node_modules
COPY --from=build --chown=willow:willow /app/apps/api/dist apps/api/dist
COPY --from=build --chown=willow:willow /app/apps/api/drizzle apps/api/drizzle
COPY --from=build --chown=willow:willow /app/apps/web/dist apps/web/dist
COPY --from=build --chown=willow:willow /app/packages/shared packages/shared
USER willow
EXPOSE 8777
VOLUME ["/data"]
ENV DATA_DIR=/data
CMD ["node", "apps/api/dist/index.js"]
