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

### [ ] 1. Patch openssl in runtime images
- Branch: `fix-predeploy-blockers-01-openssl-runtime-images`
- Base: `main`
- PR: —

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

### [ ] 3. Upgrade NestJS to 12
- Branch: `fix-predeploy-blockers-03-nestjs-12`
- Base: `fix-predeploy-blockers-02-theme-prefs-e2e`
- PR: —

Підняти `@nestjs/{core,common,platform-fastify,testing,cli,schematics}` до 12.x разом із
пакетами, що мають декларовану підтримку 12: `@nestjs/{config,cqrs,swagger,schedule,terminus,throttler}`,
`@mikro-orm/nestjs`, `nestjs-pino` (5.x), `nestjs-otel`, `nest-commander`. Override `fastify` у
`pnpm-workspace.yaml` привести до версії, яку вимагає `@nestjs/platform-fastify` 12 (5.12.4),
оновити коментар над ним. Перед bump звірити вік релізів з `minimumReleaseAge` (7 днів) і, за
потреби, зафіксувати старішу версію. Пройти breaking changes 12.x у місцях використання;
перегенерувати `src/metadata.ts`.

Ризик: `nestjs-zod` (5.5.0), `@nest-lab/throttler-storage-redis` (1.2.0) і `@sentry/nestjs`
(10.75.0) — останні версії, але їхні peer-діапазони не включають Nest 12. Перевірити на
рантаймі: інтеграційні тести, `pnpm build`, запуск API, Playwright e2e. Якщо якийсь із них
несумісний — зупинитися й повернутися до розробника, не обходити мовчки (запасний варіант:
`overrides` на Nest 11, тоді зрізи 3–4 переписуються). Перевірка: повний gate
(`type`/`lint:check`/`test:cov`/`migration:check`/`build`, metadata без diff) + Playwright.

### [ ] 4. Clear remaining audit advisories
- Branch: `fix-predeploy-blockers-04-audit-advisories`
- Base: `fix-predeploy-blockers-03-nestjs-12`
- PR: —

Після апгрейду прогнати `pnpm audit --prod` у корені та `apps/web` і закрити залишок через
оновлення або `overrides` у `pnpm-workspace.yaml`: `find-my-way` (>=9.7.0), `fast-uri`
(>=3.1.6 / >=4.1.3), `js-yaml` (>=4.3.2 / >=5.2.2, зокрема шлях через `astro` у `apps/web`).
Усі потрібні версії старші за `minimumReleaseAge`. Перевірка: `pnpm audit --prod` без знахідок,
CI `Security Audit` зелений, повний gate і e2e не зламані.
