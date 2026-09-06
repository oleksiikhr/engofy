# Build context is the repo root (needs the workspace lockfile):
#   docker build -f apps/web/Dockerfile -t engofy-web .
ARG NODE_IMAGE='26.7.0-alpine3.24'

# ------------------------------------------------------------------------------
# Base — package manager
# ------------------------------------------------------------------------------
FROM node:${NODE_IMAGE} AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"
WORKDIR /app

RUN npm install -g corepack@latest && corepack enable

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/package.json

# ------------------------------------------------------------------------------
# Build — full deps + astro build
# ------------------------------------------------------------------------------
FROM base AS build

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @engofy/web...

COPY apps/web apps/web

RUN pnpm --filter @engofy/web build

# ------------------------------------------------------------------------------
# Production deps only
# ------------------------------------------------------------------------------
FROM base AS prod-deps

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @engofy/web... --prod

# ------------------------------------------------------------------------------
# Runtime — Astro node standalone server
# ------------------------------------------------------------------------------
FROM node:${NODE_IMAGE} AS runtime

WORKDIR /app/apps/web

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
# API_ORIGIN is set at deploy time — the internal address of the Nest service.

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=prod-deps /app/apps/web/node_modules ./node_modules
COPY --from=build /app/apps/web/dist ./dist

USER 1000:1000
EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
