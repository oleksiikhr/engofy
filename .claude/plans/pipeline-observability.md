---
slug: pipeline-observability
title: Спостережуваність пайплайну постів
base_branch: main
created: 2026-09-19
status: in-progress
---

# Спостережуваність пайплайну постів

## Context

Під час локальної перевірки пост упав на стадії `ai_exercises` (модель віддала невалідний payload
`report_grammar_contrastive`), вичерпав усі спроби pg-boss і завис у `processing`. Адмін не дізнався
про це: `JobWorkerHost` при вичерпанні спроб лише ставить `PostStatus.Failed` і пише в лог, у
Telegram нічого не йде. Відповідь на `/add` містить лише `post.shortId`, а `/retry` вимагає повний
UUID, тож адмін не мав чим перезапустити пост. Потрібно, щоб бот сам повідомляв про те, що
відбувається з постом, і щоб збої були видимі без читання логів.

## Зрізи

### [x] 1. Повний ID поста та команда `/status` у боті
- Branch: `pipeline-observability-01-post-status-command`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/73

Відповідь на `/add` містить повний UUID і готовий рядок `/retry <id>`. Нова команда `/status [id]`
показує стадії поста; без id — останні пости в `processing` і `failed`. Парсинг у
`telegram/domain/parse-command.ts`, обробка в `poll-updates.service.ts`; дані брати з
`post_pipeline_runs` без нового запиту, якщо є готова логіка.

### [x] 2. Сповіщення адміну про збій пайплайну
- Branch: `pipeline-observability-02-failure-alerts`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/74

Коли пост стає `failed` (вичерпано спроби стадії), в адмін-чат (`TELEGRAM_ADMIN_USER_ID`) іде
повідомлення: повний id, стадія, короткий текст помилки, готовий `/retry <id>`. Механізм (черга або
cron за прикладом D15, поле для дедуплікації) вирішується під час зрізу. Залежить від зрізу 1
(формат повідомлення). Якщо потрібна колонка — expand-only міграція.

### [ ] 3. Сповіщення про публікацію поста
- Branch: `pipeline-observability-03-publish-notice`
- Base: `pipeline-observability-02-failure-alerts`
- PR: —

Адмін-чат отримує повідомлення, коли пост став `published`, з посиланням на нього. Використати
механізм зі зрізу 2. Залежить від зрізу 2.

### [ ] 4. Сторож для завислих постів
- Branch: `pipeline-observability-04-stuck-watchdog`
- Base: `pipeline-observability-03-publish-notice`
- PR: —

Пост у `processing` довше N хвилин (початково 15, налаштовується) дає алерт в адмін-чат. Покриває
випадки, коли нічого не впало, але й не рухається (як гейт `publish`). Дедуплікація, щоб не слати
алерт щоцикл. Залежить від зрізу 2.

### [ ] 5. Sentry для збоїв стадій
- Branch: `pipeline-observability-05-sentry-stage-failures`
- Base: `main`
- PR: —

Перевірити, що збій стадії, який вичерпав спроби, потрапляє в Sentry з тегами `postId` і `stage`, а
`AiSchemaMismatchError` групується окремо (fingerprint). Оновити skill `observability`, якщо щось
змінилось. Не залежить від зрізів 1–4.
