ARG NODE_IMAGE='26.7.0-alpine3.24'

# ------------------------------------------------------------------------------
# Install package manager
# ------------------------------------------------------------------------------
FROM node:${NODE_IMAGE} AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME/bin:$PATH"

WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

RUN npm install -g corepack@latest && corepack enable

# ------------------------------------------------------------------------------
# Build stage
# ------------------------------------------------------------------------------
FROM base AS build

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm i --frozen-lockfile

COPY . .

RUN pnpm exec nest build

# ------------------------------------------------------------------------------
# Production deps
# ------------------------------------------------------------------------------
FROM base AS deps

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm i --frozen-lockfile --prod

# ------------------------------------------------------------------------------
# Runtime stage
#
# One image, four entrypoints — the Swarm services override `command:`:
#   node main     web (HTTP, Fastify)            — default CMD
#   node worker   pg-boss worker host
#   node cron     @nestjs/schedule pollers (run EXACTLY 1 replica)
#   node cli      migrations / importers (one-shot)
# WORKDIR is /app/dist so every form is a bare `node <name>`.
#
# tini is PID 1: it forwards SIGTERM to node (graceful shutdown — closeOnce,
# pg-boss boss.stop(), cron drain) and reaps any orphans. Equivalent to
# `docker run --init`, but baked in so it does not depend on the Swarm runtime.
#
# No HEALTHCHECK here — only `node main` serves HTTP (/_healthz). worker/cron
# have no port, so per-service `healthcheck:` lives in stack.prod.yaml instead.
# ------------------------------------------------------------------------------
FROM node:${NODE_IMAGE} AS runtime

RUN apk add --no-cache tini

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER 1000:1000

WORKDIR /app/dist

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "main"]
