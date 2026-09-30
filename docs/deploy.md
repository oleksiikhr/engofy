# Deploying to DigitalOcean App Platform

Target shape and prices: `docs/hosting-direction.md`. Env var checklist: `.env.production.example`.
App spec: `.do/app.yaml` (replace `TAG` and `CHANGE_ME` placeholders before `doctl apps create --spec`; SECRET vars are entered in the control panel). The tables below describe it.

## Components

All backend components run the same image (`engofy`); only the command differs.

| Component | Type | Command | Instances | Notes |
|---|---|---|---|---|
| `web` | service | `node main` | 1+ | Public route `/api`. Health check `/_healthz`, readiness `/_healthz/ready`. |
| `apps-web` | service | image `engofy-web` (`node ./dist/server/entry.mjs`) | 1+ | Public route `/`. Port 4321. |
| `nlp` | internal service | image `engofy-nlp` | 1 | No public route. |
| `worker` | worker | `node worker` | 1 | `termination.grace_period_seconds: 180`. |
| `cron` | worker | `node cron` | **exactly 1** | `termination.grace_period_seconds: 60`. |
| `migrate` | `PRE_DEPLOY` job | `node cli migrate up` | — | A failed job aborts the deploy. |

Shutdown: `worker` waits up to `QUEUE_SHUTDOWN_TIMEOUT_MS` (120 s) for in-flight jobs, so its grace
period must be larger. `cron` drains running ticks before exit.

## Postgres connection budget

Cheapest managed plan: 22 connections.

| Process | `DB_POOL_MAX` | `QUEUE_POOL_MAX` | Other | Total |
|---|---|---|---|---|
| `web` | 5 | 2 | — | 7 |
| `worker` | 4 | 3 | — | 7 |
| `cron` | 2 | 2 | 1 (Telegram poll lock) | 5 |
| `migrate` (only while deploying) | — | — | 1–2 | 2 |
| Steady state | | | | 19 |

During a rolling deploy the old and new instances overlap, which exceeds 22 — take the 47-connection
plan (chosen in `docs/hosting-direction.md`), and verify the plan's actual `max_connections`.
The Telegram poll lock and pg-boss need direct (session) connections; if `MIKRO_ORM_HOST`/`PORT`
point at a pooler, set `QUEUE_DB_HOST`/`QUEUE_DB_PORT` to the direct endpoint.

## TLS

Managed Postgres requires TLS. Set `DB_SSL=true` + `DB_SSL_CA` (PEM from the database's panel); the
server certificate is always verified. The internal `redis` service uses no TLS and no password:
leave `REDIS_SSL`, `REDIS_SSL_CA` and `REDIS_PASSWORD` unset.

## Client IP

Traffic is Cloudflare → DO edge → app. Set `CLIENT_IP_HEADER=cf-connecting-ip` on `web`; `apps-web`
forwards the header on its own calls to `web`. Do not set `TRUST_PROXY` (numeric hop counts are
rejected, and the DO edge address is not stable). The header is only trustworthy when every request
passes through Cloudflare — a caller hitting the `*.ondigitalocean.app` hostname directly can spoof
it, so disable that default domain once the custom one works.

## Telegram poller

`PollUpdatesService` takes a Postgres advisory lock, so an old and a new `cron` overlapping during a
rollout cannot poll at once; the loser logs a warning and skips that tick. It still must run as a
single instance.

## Images

Push all three images with the same tag; that tag is `TAG` in `.do/app.yaml` (also `SENTRY_RELEASE`).
Build from the repo root (`web`/`worker`/`cron`/`migrate` share `engofy`):

```bash
REG=registry.digitalocean.com/<registry>
TAG=v0.1.0
doctl registry login
docker build --target runtime -t $REG/engofy:$TAG .
docker build --target runtime -f apps/web/Dockerfile -t $REG/engofy-web:$TAG .
docker build -f nlp-service/Dockerfile -t $REG/engofy-nlp:$TAG nlp-service
docker push $REG/engofy:$TAG && docker push $REG/engofy-web:$TAG && docker push $REG/engofy-nlp:$TAG
```

`apps/web` needs the repo root as context (workspace lockfile); `nlp-service` is standalone and uses
its own directory. Builds need BuildKit (`docker buildx`). `.github/workflows/docker.yaml` only builds
and scans `engofy`; nothing pushes to the registry.

## Seeding reference data

A fresh database has no grammar catalogue, irregular verbs, word frequency or dictionary content.
`migrate` does not seed. Run the importers once, after the first successful deploy, from the `worker`
component's console (it has the DB, `NLP_SERVICE_URL` and `PUBLIC_URL` vars):

```bash
doctl apps console <app-id> worker
```

Inside it (WORKDIR is `/app/dist`; `node cli` reads `assets/` baked into the image):

```bash
node cli grammar import-egp
node cli grammar import-irregular-verbs
node cli words import-frequency
node cli grammar import-usage-point-exercises
node cli grammar import-usage-point-content
node cli words import-lexicon-content
node cli words import-phrase-content
node cli grammar annotate-pages
```

`import-frequency` is a one-off: words the pipeline creates later are ranked on insert.

Order matters: keep it as listed (same as `make seed`, then `grammar annotate-pages`). Re-running an importer
only fills gaps or applies edits. `annotate-pages` calls `PUBLIC_URL` (the `apps-web` route) and
`nlp`, so run it only once the site and `nlp` respond. Re-run the seed commands after an `assets/`
change ships in a new image. Adding a native language also needs `post backfill-translations`
(`docs/adding-a-language.md`).

## Release checklist

1. Build and push `engofy`, `engofy-web`, `engofy-nlp` (see Images).
2. Set every var in `.env.production.example` on the matching components; secrets as encrypted vars.
3. Deploy; `migrate` runs first.
4. First deploy only: run the importers (see Seeding reference data).
5. Check `/_healthz/ready` and Sentry for the new `SENTRY_RELEASE`.
