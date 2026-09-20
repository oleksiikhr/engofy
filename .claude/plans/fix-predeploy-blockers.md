---
slug: fix-predeploy-blockers
title: Виправити блокери перед деплоєм
base_branch: main
created: 2026-09-20
status: in-progress
---

# Виправити блокери перед деплоєм

Знахідки pre-deploy перевірки: червоний CI `Docker` (Trivy) і `Security Audit` на `main`, два
e2e-тести, що падають проти prod-збірки. Ціль — зелені `Docker`, `Security Audit`, `App` і e2e
на dev- та prod-збірці. Деплой (тег `v*`) — після всіх зрізів, окремо за `docs/deploy.md`.

## Зрізи

### [x] 1. Patch openssl in runtime images
- Branch: `fix-predeploy-blockers-01-openssl-runtime-images`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/89

У runtime-стадії `Dockerfile` (api) і `apps/web/Dockerfile` додати
`apk upgrade --no-cache libcrypto3 libssl3`: базовий `node:26.7.0-alpine3.24` досі має
`3.5.7-r0`, а CVE-2026-14456 (HIGH) виправлений у `3.5.8-r0`. Trivy-крок у `docker.yaml` не
змінюється. Перевірка: CI-джоб `Docker` зелений. Залежностей від інших зрізів немає.

### [ ] 2. Make theme-prefs e2e independent of build mode
- Branch: `fix-predeploy-blockers-02-theme-prefs-e2e`
- Base: `fix-predeploy-blockers-01-openssl-runtime-images`
- PR: —

`apps/web/e2e/theme-prefs.spec.ts:56` і `:70` вимірюють фон `<body>` у момент його вставки, до
застосування зовнішнього CSS у prod-збірці (`<link rel=stylesheet>`; у dev Vite інлайнить стилі).
Залишити перевірку `data-theme` на першому пейнті, а фон вимірювати після завантаження таблиць
стилів. Перевірка: тести проходять у dev і проти prod-збірки (`astro build` +
`node dist/server/entry.mjs`); повний Playwright-набір зелений в обох режимах. Робиться перед
апгрейдом Nest, щоб e2e надійно валідував наступні зрізи.

### [ ] 3. Patch vulnerable transitive dependencies via overrides
- Branch: `fix-predeploy-blockers-03-audit-overrides`
- Base: `fix-predeploy-blockers-02-theme-prefs-e2e`
- PR: —

Nest лишається на 11.x. У `pnpm-workspace.yaml` підняти override `fastify` з `5.10.0` до `5.12.4`
і додати overrides (з діапазонами по мажорах): `find-my-way` → `>=9.7.0` (`@nestjs/platform-fastify`
11.1.28 закріплює 9.6.0), `fast-uri` → `3.1.6+` / `4.1.3+`, `js-yaml` → `4.3.2+` / `5.2.2+`
(включно зі шляхом через `astro` у `apps/web`). Усі ці версії старші за `minimumReleaseAge`
(7 днів); `fastify` 5.12.5 і `fast-uri` 4.1.5/3.1.8 під нього ще не підпадають — не брати.
Коментар над override `fastify` переписати: `@nestjs/platform-fastify` 11 закріплює 5.10.0, а
override свідомо його випереджає заради security-виправлень (дві moderate-знахідки в fastify).

Ризик: `@nestjs/platform-fastify` 11.1.28 тестувався лише з fastify 5.10.0, тому вирішальні
перевірки — інтеграційні тести, `pnpm build`, запуск API та повний Playwright. Якщо Nest 11.x
випустить патч із fastify ≥5.12.1, override `fastify` можна буде прибрати.
Перевірка: `pnpm audit --prod` без знахідок у корені й `apps/web`, повний gate
(`type`/`lint:check`/`test:cov`/`migration:check`/`build`, metadata без diff) і Playwright e2e
зелені, CI `Security Audit` зелений.
