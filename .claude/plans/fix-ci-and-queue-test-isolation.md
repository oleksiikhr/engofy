---
slug: fix-ci-and-queue-test-isolation
title: Полагодити CI-гейти та приховану залежність auth-черги від PostModule
base_branch: main
created: 2026-09-12
status: in-progress
---

# Полагодити CI-гейти та приховану залежність auth-черги від PostModule

## Контекст

Технічний аудит проєкту виявив:

1. Три CI-гейти зараз червоні на `main` (workflow "App" і "Security Audit", останній комміт
   `b8ff31b`): неотформатований `.mcp.json`, застарілий `src/metadata.ts`, і high-severity ReDoS у
   `nodemailer@9.0.5` (GHSA-2x7j-588g-ccc2, пофіксено в `9.1.0+`).
2. `src/entrypoints/web/auth/controllers/auth.controller.ispec.ts` і
   `src/core/queue/outbox-sender.service.ispec.ts` падають з реальним 500
   (`Queue auth-challenge-email does not exist`), якщо запустити їх ізольовано (`vitest run <file>`).
   Причина: `PostQueueBootstrapService` (єдине місце `boss.createQueue(...)` для всіх черг, включно з
   `QueueName.AuthChallengeEmail`) — провайдер `PostModule`, а не глобального `PgBossModule`. Ці два
   тест-файли не завантажують `PostModule`, тож черга ніколи не створюється сама — тест проходить лише
   тому, що інший ispec-файл у тому ж прогоні вже створив чергу як побічний ефект (спільна тестова
   Postgres-БД). CI цього не ловить, бо завжди запускає весь набір разом. Реальний ризик: якщо колись
   `ContentWebModule` приберуть з дефолтного набору `WebModule` або зміниться порядок бутстрапу
   модулів, продакшн-логін зламається без жодного тесту, який би це впіймав.

## Зрізи

### [x] 1. Полагодити три CI-гейти на main
- Branch: `fix-ci-and-queue-test-isolation-01-ci-gates`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/4

Відформатувати `.mcp.json` (`pnpm lint`), перегенерувати `src/metadata.ts` (`pnpm build`) і
закомітити, оновити `nodemailer` до `>=9.1.0` (`pnpm update nodemailer`). Разом з цим — закомітити вже
наявні в робочому дереві незалежні зміни (README.md, compose.yaml, `packageManager` → `pnpm@12.0.0` в
`package.json`/`pnpm-lock.yaml`), за домовленістю з розробником.

### [ ] 2. Прибрати приховану залежність auth-черги від PostModule
- Branch: `fix-ci-and-queue-test-isolation-02-auth-queue-bootstrap`
- Base: `fix-ci-and-queue-test-isolation-01-ci-gates`
- PR: —

Перенести `boss.createQueue(...)` для `QueueName.AuthChallengeEmail` з `PostQueueBootstrapService`
(`src/modules/post/post-queue-bootstrap.service.ts`, провайдер `PostModule`) у `AuthModule` (або
глобальний `PgBossModule`), лишивши `PostQueueBootstrapService` відповідальним лише за
post-пайплайн черги. Перевірити, що `auth.controller.ispec.ts` і `outbox-sender.service.ispec.ts`
проходять і при ізольованому запуску (`vitest run <file>`), не лише в повному прогоні.
