# Engofy

[![App](https://github.com/oleksiikhr/engofy/actions/workflows/app.yaml/badge.svg)](https://github.com/oleksiikhr/engofy/actions/workflows/app.yaml)
[![Docker](https://github.com/oleksiikhr/engofy/actions/workflows/docker.yaml/badge.svg)](https://github.com/oleksiikhr/engofy/actions/workflows/docker.yaml)
[![Security Audit](https://github.com/oleksiikhr/engofy/actions/workflows/security-audit.yaml/badge.svg)](https://github.com/oleksiikhr/engofy/actions/workflows/security-audit.yaml)

## Prerequisites

- **Docker** + **Docker Compose**
- **pnpm** ≥ 12, installed as a standalone binary (no separate Node.js version manager needed):

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -   # standalone pnpm, no Node.js needed
pnpm self-update 12.0.0                            # match the version pinned in package.json
pnpm runtime set node -g                           # makes bare `node` resolve per-project too
```

Then **open a new terminal** (the installer edits `.zshrc`/`.bashrc`, which an already-open shell won't pick up).

The root pins Node via `.nvmrc` (v26.7.0); `apps/web` pins its own version the same way. Anything run through pnpm (`pnpm run`, `pnpm exec`, `pnpm i`) resolves it automatically.

- **Python** ≥ 3.11 + a virtualenv, for `nlp-service` (see [nlp-service/README.md](nlp-service/README.md)) — only needed if you're touching the NLP pipeline.

## Quick Start

### First time

```bash
make setup
```

Installs Node dependencies and runs pending migrations. `.env.development` is loaded automatically in dev — fill in the required credentials there (`ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `RESEND_API_KEY`, etc.).

```bash
make up        # start Postgres, Redis, Mailpit, Spotlight (Docker)
make watch      # start the NestJS API with hot reload
```

On a fresh database, seed the static reference data (grammar catalogue, irregular
verbs, word frequency — see [assets/README.md](assets/README.md)):

```bash
pnpm cli grammar import-egp                # 19 categories / 90 constructions / 574 usage points
pnpm cli grammar import-irregular-verbs    # ~164 words
pnpm cli words import-frequency            # ranks existing Word rows
```

### Daily workflow

| Command                | Description                                                     |
|-------------------------|------------------------------------------------------------------|
| `make up` / `make down` | Start / stop all Docker containers                                |
| `make watch`            | Start the NestJS API locally with hot reload                     |
| `make worker`           | Start the pg-boss worker (all queues)                             |
| `make sync`             | Install dependencies and run pending migrations after a branch switch |
| `make migrate`          | Run all pending database migrations                                |
| `make migrate-create`   | Generate a new migration from the current entity diff              |
| `make migrate-rollback` | Revert the last executed migration                                 |
| `make migrate-fresh`    | **Destructive** — drop the DB schema and re-run all migrations      |
| `make test`             | Run the vitest suite                                                |
| `make lint`             | Run Biome and apply fixes                                           |
| `make type`             | Run `tsc --noEmit`                                                   |
| `make logs`             | Follow logs from all Docker containers                              |
| `make logs-<name>`      | Follow logs from a specific container (e.g. `make logs-postgres`)   |

Run `make help` for the full list (Docker container management, per-container `up-%`/`stop-%`/`exec-%`, etc.).

The Astro frontend (`apps/web`) and the NLP service (`nlp-service`) each have their own dev commands — see their sub-project docs below.

## Access

| URL                                | Service                                  |
|-------------------------------------|-------------------------------------------|
| http://localhost:8080               | NestJS backend API                        |
| http://localhost:8080/_swagger      | NestJS Swagger (dev only)                 |
| http://localhost:8080/_healthz      | Liveness probe                            |
| http://localhost:8080/_healthz/ready| Readiness probe (Postgres + Redis)        |
| http://localhost:4321               | Frontend (Astro)                          |
| http://localhost:8000               | NLP service (FastAPI + spaCy)             |
| http://localhost:8025               | Mailpit (local email UI)                  |
| http://localhost:8969               | Spotlight (local Sentry UI)               |
| http://localhost:5432               | Postgres                                  |
| http://localhost:6379               | Redis                                     |

## Troubleshooting

- **`pnpm` fails with `This is a placeholder. pnpm's native binary replaces this file during
  installation...`** — the version pinned by `packageManager` in `package.json` (managed under
  `~/.local/share/pnpm/.tools/pnpm/<version>/`) downloaded but never finished its install/build step.
  Fix: `cd ~/.local/share/pnpm/.tools/pnpm/<version>*/node_modules/pnpm && node install.js`, then retry.
- **Never `source .env.development`/`.env.test` directly** (e.g. to run a `pnpm`/`mikro-orm` command
  by hand outside `make`) — `MAIL_FROM_EMAIL=Engofy <noreply@engofy.com>` has an unescaped `<` that
  bash parses as redirection, breaking `source`/`export -a` outright. Prefix the command with
  `NODE_ENV=development` (or `test`) instead; NestJS's `ConfigModule` reads the right `.env.*` file
  itself.
- **A new `git worktree` has no `node_modules`** (not shared between worktrees) — run `pnpm i`
  (or `make sync`, which also re-runs pending migrations) inside it before any `pnpm`/`make` command.
  `.env.development`/`.env.test` need no such copying — they're committed to the repo, so a worktree
  checks them out like any other tracked file.
- **Don't run `make up`/`docker compose` from inside a worktree expecting a separate stack** —
  `compose.yaml` pins `name: engofy`, so it always resolves to the one shared Postgres/Redis/etc.
  regardless of which worktree directory it's run from (Compose otherwise defaults the project name to
  the cwd's basename, which differs per worktree and would fight the main stack for the same host
  ports). Postgres/Redis are meant to be one shared instance across all worktrees of this repo, not
  one per worktree.
- **Two worktrees' app/tests running at the same time will stomp on each other's data by default** —
  `.env.development`/`.env.test` are the same tracked file checked out identically into every worktree,
  so every worktree's `MIKRO_ORM_DB_NAME`/`REDIS_DB` points at the same logical database/Redis DB on
  the one shared stack above. Fine for sequential work (only one worktree's app/tests actually running
  at a time — the common case). For genuinely concurrent worktrees, rename that worktree's own copy of
  `MIKRO_ORM_DB_NAME` (and create the DB first — the `engofy` role has `CREATEDB`:
  `docker compose exec postgres createdb -U engofy <name>`) and pick a different `REDIS_DB` index;
  otherwise concurrent migrations/tests race on the same schema/rows.

## Project Structure

```
engofy/
├── src/            NestJS backend (TypeScript, PostgreSQL, pg-boss queues)
├── test/           Backend integration/e2e tests
├── apps/web/       Astro frontend
├── nlp-service/    FastAPI + spaCy NLP microservice (Python)
└── docs/           Project docs
```

## Claude Code — Skills

Skills are tracked directly in this repo, not fetched from external sources:

- `.agents/skills/<name>/SKILL.md` holds the real skill file.
- `.claude/skills/<name>` is a symlink into `.agents/skills/<name>` — that's what Claude Code actually loads.

See `CLAUDE.md` for the full list of skills and what each one does.

## Sub-project Docs

- [Hosting direction (DigitalOcean, managed-first)](docs/hosting-direction.md)
- [NLP service](nlp-service/README.md)
