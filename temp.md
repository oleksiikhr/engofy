# engofy — наступні дії (деплой Batch S)

Весь код/конфіг готовий і закомічений на `fix/batch-a-safety` (12 комітів `batch s — …`, не запушено).
Далі — операційні кроки. Орієнтир: `docs/deploy.md`.

## 1. Гілка та код
- [ ] Переглянути коміти Batch S: `git log 28e3df6..HEAD`
      (ключове: `infra/stack.prod.yaml`, `infra/cloudflared/config.yml`, `docs/deploy.md`).
- [ ] Запушити гілку → PR → влити в `main`.
      Потрібно: `deploy.yaml` тригериться на теґ `v*`, `web-e2e.yaml` — на `main`.
      Після мерджу пройде повний CI-гейт + новий job `apps-web`.

## 2. Зовнішні акаунти / ресурси (паралельно)
- [ ] **Hetzner Cloud**: VM (Ubuntu 24.04, CPX31/41). Cloud Firewall: inbound deny-all, outbound all.
- [ ] **Cloudflare**: домен `engofy.com` на NS Cloudflare.
      `cloudflared tunnel create engofy` → `<TUNNEL_ID>` + credentials JSON.
- [ ] **Cloudflare R2**: бакети `engofy` (аплоади) + `engofy-backups` (дампи).
      API-токен *Object Read & Write*. Записати `S3_ENDPOINT = https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
      На `engofy-backups` — lifecycle rule «видаляти `pg/` через 30 днів».
- [ ] **Resend**: API-ключ, верифікувати домен для `onboarding@engofy.com`.
- [ ] **Anthropic / Telegram bot / Sentry**: ключі / токен / DSN.
- [ ] (опц.) **Google OAuth** client id — якщо потрібен вхід через Google.

## 3. GitHub secrets (репо або environment `production`)
- [ ] `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY` — SSH до менеджера.
- [ ] `GHCR_USERNAME=oleksiikhr`, `GHCR_TOKEN` — PAT з `read:packages` (щоб VM тягнула образи).
- [ ] (опц.) захистити environment `production` required-reviewer.

## 4. На VM (один раз) — `docs/deploy.md` §1–§3
- [ ] `curl -fsSL https://get.docker.com | sh`; `docker swarm init`.
- [ ] `mkdir -p /opt/engofy/infra /var/backups/engofy-pg`.
- [ ] Створити `docker secret`: `engofy_db_password`, `engofy_anthropic_api_key`,
      `engofy_resend_api_key`, `engofy_telegram_bot_token`, `engofy_s3_access_key`,
      `engofy_s3_secret_key`, `engofy_sentry_dsn`, `engofy_cloudflared_credentials`.
- [ ] `sed` `<TUNNEL_ID>` у `infra/cloudflared/config.yml` →
      `docker config create engofy_cloudflared_config infra/cloudflared/config.yml`.
- [ ] `cloudflared tunnel route dns engofy engofy.com`.
- [ ] `/opt/engofy/infra/.env.production` з `.env.production.example`
      (`PUBLIC_URL`, `S3_*`, `TELEGRAM_*`, `SENTRY_RELEASE`, `GOOGLE_CLIENT_ID`…).
- [ ] `echo $GHCR_PAT | docker login ghcr.io -u oleksiikhr --password-stdin`.

## 5. Перший деплой
- [ ] `git tag v0.1.0 && git push origin v0.1.0` →
      `deploy.yaml` збере/запушить 3 образи в GHCR і виконає `infra/deploy.sh` по SSH
      (міграції one-shot → `docker stack deploy`).
- [ ] Очікувати, що перший прогін `deploy.yaml` доведеться підправити (не тестований на живому раннері).
- [ ] Альтернатива вручну на VM: `cd /opt/engofy/infra && IMAGE_TAG=v0.1.0 ./deploy.sh`.

## 6. Перевірка
- [ ] `docker stack services engofy` — усі `n/n`.
- [ ] `docker service logs engofy_cloudflared` — «Registered tunnel connection».
- [ ] `https://engofy.com` та `https://engofy.com/api/content/feed` віддають.
- [ ] `curl` liveness `/_healthz` і readiness `/_healthz/ready`.

## 7. Після запуску
- [ ] Крон `infra/pg-backup.sh` + `/etc/engofy-pg-backup.env` (`docs/deploy.md` §7);
      тестовий ручний прогін + тестовий `pg_restore`.
- [ ] Увімкнути `web-e2e.yaml` (тригер на `main`; допиляти job за першим прогоном).
- [ ] У `REVIEW.md` познач deferred-беклог **#6 як closed**, коли edge-routing реально працює в проді.

---

## Відкритий технічний борг (див. розмову)
- `src/migrate.ts` — **дублікат** наявної CLI-команди `node cli migrate up`
  (`src/entrypoints/cli/migrate/migrate-up.command.ts`; `nest-commander` — prod-залежність,
  працює в `--prod` образі, перевірено). Рішення видалити його й повернути
  `deploy.sh` / `docs/deploy.md` / Dockerfile на `node cli migrate up`.
