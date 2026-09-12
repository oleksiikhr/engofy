---
slug: e2e-page-object-models
title: Перевести apps/web e2e тести на Page Object Model
base_branch: main
created: 2026-09-12
status: in-progress
---

# Перевести apps/web e2e тести на Page Object Model

Зараз `apps/web/e2e/*.spec.ts` тримають усі локатори (CSS-класи, testid, ролі)
просто в тілі тестів, дублюючи їх між guest/signed-in блоками — зміна розмітки
означає правки одразу в кількох спек-файлах. Переносимо структуру сторінки в
`apps/web/e2e/pages/*.ts` за зразком `~/dev/echoengine/e2e/pages/`: один клас
на маршрут, локатори як `readonly`-поля в конструкторі, `goto()` +
`expectLoaded()`, параметризовані лукапи як методи (`rowByTitle(title)`)
замість повторення в тестах. Без спільного `BasePage` — echoengine його теж не
має, кожен POM незалежний.

Інфраструктура автентифікації (`global-setup.ts`, `auth.ts`) не змінюється —
проблема в дублюванні структури сторінки в спеках, не в сесійному механізмі.

## Зрізи

### [x] 1. POM scaffolding + login/feed/smoke
- Branch: `e2e-page-object-models-01-login-feed-smoke`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/5

Створити `pages/login-page.ts`, `pages/feed-page.ts`. Переписати
`login.spec.ts`, `feed.spec.ts` на них; `smoke.spec.ts` використовує
`FeedPage.goto()` для навігації на `/`, залишаючи власні assertions (shell,
font token) без змін. Цей зріз задає конвенцію (readonly локатори в
конструкторі, goto/expectLoaded), яку повторюють наступні зрізи.

### [x] 2. practice + grammar
- Branch: `e2e-page-object-models-02-practice-grammar`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/7

Створити `pages/practice-page.ts`, `pages/grammar-page.ts` (список
`/grammar`), `pages/grammar-construction-page.ts` (деталі
`/grammar/{slug}` — окремий маршрут, окремий клас). Переписати
`practice.spec.ts`, `grammar.spec.ts`.

### [x] 3. dictionary + profile + pricing
- Branch: `e2e-page-object-models-03-dictionary-profile-pricing`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/8

Створити `pages/dictionary-page.ts`, `pages/profile-page.ts`,
`pages/pricing-page.ts`. Переписати `dictionary.spec.ts`, `profile.spec.ts`,
`pricing.spec.ts`.

### [ ] 4. reader
- Branch: `e2e-page-object-models-04-reader`
- Base: `e2e-page-object-models-03-dictionary-profile-pricing`
- PR: —

Створити `pages/reader-page.ts` (sidebar групи Grammar/Words/Phrases,
fill-blank та comprehension вправи — найбільша й найскладніша сторінка).
Переписати `reader.spec.ts`. Останній зріз — не задає нових конвенцій понад
ті, що встановили зрізи 1-3.
