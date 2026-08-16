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
# ------------------------------------------------------------------------------
FROM node:${NODE_IMAGE} AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

USER node

WORKDIR /app/dist

CMD ["node", "main"]
