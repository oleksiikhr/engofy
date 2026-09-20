# engofy — production deploy runbook

Target: a single Hetzner Cloud VM running Docker Swarm. All inbound traffic
arrives through one Cloudflare Tunnel (`cloudflared` runs as a Swarm service);
the Hetzner firewall denies **all** inbound. No port is published by the stack.

```
                      ┌─────────── Cloudflare edge ───────────┐
   browser ──HTTPS──▶ │  engofy.com                           │
                      └───────────────┬───────────────────────┘
                                      │ Cloudflare Tunnel (outbound from the VM)
                          ┌───────────▼─────────────┐
                          │ cloudflared  (×2)       │  ingress rules:
                          │  /api/*  -> web:8080    │   infra/cloudflared/config.yml
                          │  else    -> apps-web    │
                          └───────────┬─────────────┘
        overlay "engofy_engofy" (encrypted)
   ┌──────────┬──────────┬───────────┬──────────┬─────────┬─────────┐
   │ web ×2   │ worker×1 │ cron ×1   │ nlp ×1   │apps-web │ postgres│ redis
   │ node main│node work.│node cron  │ uvicorn  │  ×2     │  ×1 vol │  ×1
   └──────────┴──────────┴───────────┴──────────┴─────────┴─────────┘
```

Repo artifacts:

| Path | What |
|---|---|
| `Dockerfile` | Nest image — `node {main,worker,cron,migrate,cli}` |
| `apps/web/Dockerfile` | Astro SSR image |
| `nlp-service/Dockerfile` | spaCy image (internal only) |
| `docker-entrypoint.sh` | maps `/run/secrets/*` → `UPPER_SNAKE` env (Nest image) |
| `infra/stack.prod.yaml` | the Swarm stack |
| `infra/cloudflared/config.yml` | tunnel ingress rules |
| `infra/deploy.sh` | rollout: migrate one-shot → `docker stack deploy` |
| `infra/pg-backup.sh` | `pg_dump` → Cloudflare R2 (host cron) |
| `.env.production.example` | full env matrix |
| `.github/workflows/deploy.yaml` | build+push GHCR, then run `deploy.sh` over SSH |

---

## 1. One-time provisioning (greenfield)

### 1.1 The VM

- Create a Hetzner Cloud VM (Ubuntu 24.04 LTS, x86; CPX31/CPX41 is a fine
  start). Give it an IPv4.
- **Firewall (Hetzner Cloud Firewall):** inbound — allow nothing (SSH included
  is optional; prefer Hetzner's web console or a VPN). Outbound — allow all
  (the tunnel dials out on 443/7844). There is no HTTP/HTTPS inbound rule
  anywhere: Cloudflare reaches the origin only through the tunnel.
- DNS: point `engofy.com` at Cloudflare (nameservers) — the tunnel route
  (step 3) creates the proxied record.

### 1.2 Base packages

```bash
# as root on the VM
apt-get update && apt-get -y upgrade
curl -fsSL https://get.docker.com | sh          # Docker CE + compose plugin + buildx
systemctl enable --now docker
mkdir -p /opt/engofy/infra /var/backups/engofy-pg
```

### 1.3 Swarm

```bash
docker swarm init --advertise-addr <VM_PRIVATE_OR_PUBLIC_IP>
docker node ls          # one node, MANAGER, Ready
```

Single node: it is the only manager and the only worker. Every service in
`stack.prod.yaml` is constrained to `node.role == manager`.

---

## 2. Secrets and config on the box

### 2.1 Application secrets

`stack.prod.yaml` mounts each with a `target:`; `docker-entrypoint.sh` turns the
target into the env var. Create them once:

```bash
printf %s 'SUPER-SECRET-DB-PASSWORD'      | docker secret create engofy_db_password -
printf %s 'sk-ant-...'                    | docker secret create engofy_anthropic_api_key -
printf %s 're_...'                        | docker secret create engofy_resend_api_key -
printf %s '123456:ABC-telegram-bot-token' | docker secret create engofy_telegram_bot_token -
printf %s 'https://<key>@<org>.ingest.sentry.io/<project>' | docker secret create engofy_sentry_dsn -
```

`printf %s` (no trailing newline) — the entrypoint also strips trailing
newlines, but keep secrets clean.

### 2.2 Non-secret config

```bash
# from a checkout, or scp the file up
cp .env.production.example /opt/engofy/infra/.env.production
# then edit /opt/engofy/infra/.env.production:
#   PUBLIC_URL=https://engofy.com
#   IMAGE_TAG=<first release tag>          # deploy.sh overrides this per run
#   TELEGRAM_ADMIN_USER_ID=...  TELEGRAM_CHANNEL_ID=@engofy
#   GOOGLE_CLIENT_ID=...  PUBLIC_GOOGLE_CLIENT_ID=...   (blank = Google login off)
#   SENTRY_RELEASE=<tag>
```

`infra/.env.production` is git-ignored. Keep a copy in your password manager.

### 2.3 GHCR pull auth

The box pulls private images. Use a GitHub PAT with `read:packages`:

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u oleksiikhr --password-stdin
```

`deploy.sh` passes `--with-registry-auth` so the swarm ships this credential to
the (single) node on every deploy.

---

## 3. Cloudflare Tunnel

Do this on any machine with `cloudflared` + `cloudflare` login, or in a
throwaway container. One tunnel, one host.

```bash
cloudflared tunnel login                      # browser auth, pick the zone
cloudflared tunnel create engofy              # prints <TUNNEL_ID> + writes
                                              # ~/.cloudflared/<TUNNEL_ID>.json
cloudflared tunnel route dns engofy engofy.com
```

Wire it into the stack:

```bash
# 1. put the id into the ingress config
sed -i 's/<TUNNEL_ID>/'"$TUNNEL_ID"'/' infra/cloudflared/config.yml

# 2. the config -> a Docker config
docker config create engofy_cloudflared_config infra/cloudflared/config.yml

# 3. the credentials JSON -> a Docker secret
docker secret create engofy_cloudflared_credentials ~/.cloudflared/$TUNNEL_ID.json
```

Rotating the ingress config later: Docker configs are immutable — create
`engofy_cloudflared_config_v2`, point the `cloudflared` service's `configs:` at
it, redeploy, then `docker config rm` the old one.

---

## 4. First deploy

```bash
scp infra/stack.prod.yaml infra/deploy.sh root@<VM>:/opt/engofy/infra/
ssh root@<VM>
cd /opt/engofy/infra
IMAGE_TAG=v0.1.0 ./deploy.sh          # after CI has pushed the v0.1.0 images
```

`deploy.sh`:

1. `docker pull` the Nest image for `$IMAGE_TAG`.
2. Runs migrations as a **one-shot swarm service** (`engofy_migrate`,
   `--restart-condition none`, on the overlay, `engofy_db_password` mounted) →
   `node cli migrate up`. Waits for the task to `Complete`, prints its logs,
   removes it. **Aborts the deploy if it did not complete cleanly.**
3. `docker stack deploy -c stack.prod.yaml --with-registry-auth --prune engofy`.

Watch it come up:

```bash
docker stack services engofy          # REPLICAS should reach n/n
docker service logs -f engofy_web
docker service logs -f engofy_cloudflared   # "Registered tunnel connection"
```

Then hit `https://engofy.com` and `https://engofy.com/api/content/posts`.

---

## 5. Routine release

Preferred — via CI:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

`deploy.yaml` builds + pushes the three images to GHCR, then SSHes to the
manager and runs `infra/deploy.sh` with `IMAGE_TAG=v0.2.0`. The `App` workflow
also runs on the tag (full type/lint/test/`migration:check` gate) — **only tag
green commits.**

Manual (from the box, images already in GHCR):

```bash
cd /opt/engofy/infra && IMAGE_TAG=v0.2.0 ./deploy.sh
```

`update_config: order: start-first` for the stateless services (`web`,
`apps-web`, `nlp`, `worker`) means a new task is healthy before the old one
stops — no downtime. `cron` is `stop-first` + `replicas: 1` (never two Telegram
pollers at once). `worker` has `stop_grace_period: 120s` so an in-flight AI
stage (~2 min) finishes rather than being retried.

### Rollback

```bash
# one service, to its previous spec:
docker service rollback engofy_web

# or redeploy the whole stack at the previous tag:
cd /opt/engofy/infra && IMAGE_TAG=v0.1.9 ./deploy.sh
```

A migration is **not** auto-rolled-back. If a release added a migration and you
must go back, restore the DB from backup (§7) or write a down-migration and run
`node cli migrate down` — decide per case. Keep releases with schema changes
small.

---

## 6. Migrations

- The gate: CI (`app.yaml`) runs `pnpm migration:up && pnpm migration:check`
  against a clean DB on every push — entities drifting from migrations fails CI
  (D17).
- At deploy: `deploy.sh` runs `node cli migrate up` (the app's own
  `nest-commander` CLI — `src/entrypoints/cli/migrate/`, `orm.migrator.up()`),
  which works in the `--prod` runtime image. `pnpm migration:up` does not — it
  needs the mikro-orm CLI + swc loader, which are devDeps.
- Ad-hoc, against the live DB: just re-run `cd /opt/engofy/infra && IMAGE_TAG=<current> ./deploy.sh`. Its migrate step is idempotent (`no pending migrations` on a no-op) and it only re-deploys the stack if migration succeeded. If you want migrate **without** a stack redeploy, run just that one-shot service by hand — same flags `deploy.sh` uses:

  ```bash
  docker service create --name engofy_migrate --network engofy_engofy \
    --restart-condition none --env-file /opt/engofy/infra/.env.production \
    -e NODE_ENV=production -e MIKRO_ORM_HOST=postgres -e MIKRO_ORM_PORT=5432 \
    -e MIKRO_ORM_USER=engofy -e MIKRO_ORM_DB_NAME=engofy \
    --secret source=engofy_db_password,target=mikro_orm_password \
    ghcr.io/oleksiikhr/engofy:<TAG> node cli migrate up
  docker service logs engofy_migrate
  docker service rm engofy_migrate
  ```

---

## 7. Postgres backup & restore

### Backup (cron on the manager)

```bash
scp infra/pg-backup.sh root@<VM>:/opt/engofy/infra/
# EnvironmentFile with the R2 creds (root-only):
cat >/etc/engofy-pg-backup.env <<'EOF'
R2_BUCKET=engofy-backups
R2_ENDPOINT=https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
AWS_ACCESS_KEY_ID=<R2 token, Object Read & Write>
AWS_SECRET_ACCESS_KEY=<...>
EOF
chmod 600 /etc/engofy-pg-backup.env

# crontab -e  (root):
5 3 * * *  set -a; . /etc/engofy-pg-backup.env; set +a; /opt/engofy/infra/pg-backup.sh >> /var/log/engofy-pg-backup.log 2>&1
```

`pg-backup.sh` does `pg_dump -Fc --no-owner` out of the running `engofy_postgres`
task and streams it to `s3://$R2_BUCKET/pg/engofy-engofy-<ts>.dump` via a
throwaway `amazon/aws-cli` container. Local copies in `/var/backups/engofy-pg`
are pruned after `KEEP_LOCAL_DAYS` (7). **Set an R2 lifecycle rule** on the
bucket (expire `pg/` after 30 days) instead of pruning remotely.

### Restore

```bash
# fetch the dump (aws-cli container, same endpoint) into the cwd, then:
cid=$(docker ps -q -f label=com.docker.swarm.service.name=engofy_postgres)
docker exec -i "$cid" pg_restore --clean --if-exists --no-owner \
  -U engofy -d engofy < engofy-engofy-<ts>.dump
```

Restore into a fresh DB first if you can, and point `web`/`worker`/`cron` at it
before switching for real.

---

## 8. Secret rotation

`docker secret` values are immutable. To rotate e.g. the DB password:

1. `printf %s 'NEW' | docker secret create engofy_db_password_v2 -`
2. In `stack.prod.yaml`, change every `source: engofy_db_password` to
   `engofy_db_password_v2` (keep the `target:` unchanged), and the `postgres`
   service's `secrets:` entry too.
3. Change the password inside Postgres to match (`ALTER ROLE engofy PASSWORD …`)
   — do this in the same window; `postgres` reads `POSTGRES_PASSWORD_FILE` only
   on first init, so an existing volume keeps the old password until you
   `ALTER`.
4. `./deploy.sh` (redeploys with the new secret).
5. `docker secret rm engofy_db_password`.

API keys (Anthropic, Resend, Telegram, Sentry) are simpler — steps 1, 2, 4,
5 only.

---

## 9. Observability & day-2 ops

| Need | Command |
|---|---|
| Service health | `docker stack services engofy` |
| Task detail / which node / why restarting | `docker service ps --no-trunc engofy_worker` |
| Logs | `docker service logs -f --tail 200 engofy_web` |
| Liveness (what Swarm probes) | `curl -sf http://<task>:8080/_healthz` → `{"status":"ok"}` |
| Readiness (DB + Redis) | `curl http://<task>:8080/_healthz/ready` → 200 or 503 |
| Tunnel status | `docker service logs engofy_cloudflared` / `:2000/ready` on the overlay |
| Scale a stateless service | `docker service scale engofy_apps-web=3` |
| Force a fresh pull of a tag | `docker service update --force engofy_web` |

- **Swagger is disabled in production** (`main.ts` guards `SwaggerModule.setup`
  behind `!isProdEnvironment()`), and `cloudflared` has no route to `/_swagger`.
- Sentry: DSN via the `engofy_sentry_dsn` secret; `tracesSampleRate` defaults to
  `0.1` in prod (`SENTRY_TRACES_SAMPLE_RATE_{WEB,WORKER,CRON}` in the stack).
- `TRUST_PROXY=uniquelocal` (in the stack) = trust peers in private ranges
  (the overlay network, i.e. cloudflared); the app then sees the real client IP
  for throttling / OTP counters / secure-cookie decisions. Numeric hop counts
  (`TRUST_PROXY=1`) are rejected at startup.
- Redis is ephemeral (throttler window + `otp:ip` counters). A Redis restart
  just resets rate-limit windows — it does not fail liveness, so Swarm will not
  kill `web` over it.
- `cron` must stay at **exactly one** replica.

---

## 10. Connection budget

Each Nest process holds a MikroORM pool (`DB_POOL_MAX`, default 10) **and** a
pg-boss pool (`QUEUE_POOL_MAX`, default 5): `web ×2` + `worker ×1` + `cron ×1` ≈
`4 × 15 = 60`, plus the `migrate` one-shot and `psql` sessions. `postgres` runs
with `max_connections=150` (stack command). If you scale `web`/`worker` past
that headroom, lower the pool env vars or put PgBouncer (transaction pooling) in
front — pg-boss needs session-level `LISTEN/NOTIFY`, so give it a separate
PgBouncer database in `session` mode or a direct connection.
