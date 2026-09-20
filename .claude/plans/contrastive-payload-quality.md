---
slug: contrastive-payload-quality
title: Якість payload для grammar_contrastive
base_branch: main
created: 2026-09-19
status: in-progress
---

# Якість payload для grammar_contrastive

## Context

Після PR #59 (розпаковка JSON-рядка в схемі, 3 спроби на правило, пропуск після невдач) стадія
`ai_exercises` більше не падає, але на живому прогоні поста з 10 граматичних правил 2 правила
пропущено: усі 3 спроби моделі не пройшли схему `report_grammar_contrastive`. Тобто ~20% контрастивних
вправ губляться. У логах видно, що `options` приходить рядком, який не є JSON-масивом (тож
`parseJsonArrayString` його не рятує), а в одній із відповідей `answerIndex` не число. Схоже, модель
зіпсовує серіалізацію вкладених паралельних масивів (`options` + `optionExplanations`). Сирий
payload не логується, тож точну форму збою зараз не видно.

## Зрізи

### [x] 1. Логувати сирий payload при збої схеми
- Branch: `contrastive-payload-quality-01-capture-raw-payload`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/78

`AnthropicClientService.completeStructured` при `safeParse` не пройдено кладе в `AiSchemaMismatchError`
лише `ZodError`, без `toolUse.input`. Додати обрізаний (напр. до 2 KB) сирий `input` у `cause`/лог, без
зміни поведінки повтору. Це дозволяє побачити реальну форму зіпсованих відповідей у логах і Sentry.
Також додати лічильник пропущених правил у підсумковий лог `ai_exercises` (скільки правил, скільки
пропущено).

### [ ] 2. Знизити частку пропущених правил
- Branch: `contrastive-payload-quality-02-reduce-skips`
- Base: `contrastive-payload-quality-01-capture-raw-payload`
- PR: —

За даними зі зрізу 1 обрати виправлення: спростити схему (напр. один масив об'єктів
`{ text, explanation }` замість паралельних `options` та `optionExplanations`, `answerIndex` лишається
або стає `correct: true` на опції) і/або підкрутити підказку в `grammar-contrastive-prompt.ts`. Перевірити
на живому API на постах з 10+ правилами (ціль: 0–1 пропущених правил на пост) і зафіксувати результат у
PR. Зміна формату payload у `exercises.payload` — контракт із `apps/web`: рідер має читати і старий, і
новий формат (expand-contract), бо старі вправи вже в БД.
