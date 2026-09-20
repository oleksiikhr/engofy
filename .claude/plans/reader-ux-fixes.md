---
slug: reader-ux-fixes
title: Правки UX рідера, стрічки, граматики та practice
base_branch: main
created: 2026-09-20
status: in-progress
---

# Правки UX рідера, стрічки, граматики та practice

Контекст: 12 правок після живого огляду `apps/web` (reader, /posts, /practice, /grammar). Рішення
погоджені: клік на будь-яке слово — через дані lexicon (без нових ендпоінтів); "прочитано" — кнопка +
суворіший авто-тригер; статус граматики ігнорує CEFR-default; Study mode — покроковий inline-квіз по
абзацах. Усі зміни API — лише адитивні (нові опційні поля, один новий ендпоінт, змінена деривація
наявного `state`), тому окремого зрізу на видалення deprecated немає — свідомий виняток із правила
3+ зрізів; фронтенд читає нові поля опційно.

## Зрізи

### [x] 1. Layout polish: меню, скролбар, англійські тексти
- Branch: `reader-ux-fixes-01-layout-polish`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/80

Правки №1, №10, №11. `.menu` (аватар) вище за `.reader-toolbar` (stacking context на `.site-header`,
z-index < `.lex-popup`). `scrollbar-gutter: stable` на `:root`. Переклад усіх видимих кириличних
рядків (`practice-filter.ts`, `practice.astro`, `practice-card.ts`, `dictionary-detail.ts`) та
оновлення e2e (`dictionary.spec.ts`, `practice.spec.ts`). e2e: меню зверху над toolbar, ширина
viewport не змінюється між коротким і довгим контентом.

### [x] 2. Tooltip зберігає стан "в колоді"
- Branch: `reader-ux-fixes-02-popup-deck-state`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/81

Правка №2. У `reader-popup.ts` `afterSwap` записувати новий `state` назад у
`data.words/phrases/grammar[id]`. e2e без стабу `lexicon-action`: Add to deck → закрити → відкрити
знову → "Learning" без кнопки Add; те саме для фрази; стан зберігається після reload.

### [ ] 3. Стрибки на /posts при фільтрації
- Branch: `reader-ux-fixes-03-posts-filter-jump`
- Base: `reader-ux-fixes-02-popup-deck-state`
- PR: —

Правка №12. Прибрати відкладене згортання `#posts-results` (`max-height:0`) та skeleton; старі
результати лишаються видимими (dim через `.htmx-request`), `min-height`. Подвійний запит:
`hx-sync="this:replace"` на формі, search-інпут без `change` у trigger. e2e: один запит
`/partials/posts` на клік по чипу і на Enter; висота `#posts-results` не падає до ~0.

### [ ] 4. Статус граматики на /grammar
- Branch: `reader-ux-fixes-04-grammar-status`
- Base: `reader-ux-fixes-03-posts-filter-jump`
- PR: —

Правка №9. `get-grammar-reference.handler.ts`: агрегація без CEFR-default — Learned лише коли всі
usage points Learned/Skipped через картку/disposition, Learning — є картка або частково, інакше New;
опційні `learnedCount`/`totalCount` (+ по CEFR). Детальна сторінка: "X/Y learned" по рівнях, below-level
default показується як "Assumed known". Оновити ispec/spec/e2e (`get-grammar-reference.handler.ispec.ts`,
`effective-state-priority.spec.ts`, `content.controller.ispec.ts`, `grammar.spec.ts`).

### [ ] 5. Прочитано: кнопка та суворіший авто-тригер
- Branch: `reader-ux-fixes-05-read-state`
- Base: `reader-ux-fixes-04-grammar-status`
- PR: —

Правка №8. Бекенд: `DELETE /content/posts/:slugId/read` (204, login, ідемпотентний) +
`UnmarkPostReadCommand`; `isRead` у `PostDetailResponseDto`. Web: `partials/unmark-read.ts`, контрол
"✓ Read / Mark as unread" на сторінці поста, авто-mark лише після реального скролу до кінця (не на
першому пейнті), Finish у study mode теж позначає. Тести: ispec хендлера й контролера, e2e.

### [ ] 6. Рідер без стрибків + прибрати Function words
- Branch: `reader-ux-fixes-06-reader-no-shift`
- Base: `reader-ux-fixes-05-read-state`
- PR: —

Правки №3, №6. Видалити перемикач Function words (UI, pref `function-words`, CSS, boot-атрибут).
Обгортання токенів `[data-tok]` переїжджає на сервер (`render-doc.ts`), клієнтський `wrapTokens`
видаляється. Стилі режимів (pressed-стан, легенди, `.reader-analyze`) — від
`:root[data-reader-modes~=...]`, який виставляє pre-paint `bootScript`. e2e: з `reader-modes=analyze`
геометрія `.reading-body` і toolbar однакова до та після гідратації.

### [ ] 7. Клік на будь-яке слово/фразу/граматику
- Branch: `reader-ux-fixes-07-click-any-word`
- Base: `reader-ux-fixes-06-reader-no-shift`
- PR: —

Правка №4. `render-doc.ts` видає id для всіх lexicon-збігів (також learned/skipped); підсвітка лише для
`new|learning`, решта — легка hover-афорданс. Попап для learned/skipped показує стан без "Add to deck".
Спершу перевірити, що `get-post-detail` віддає `state` для всіх збігів (якщо ні — адитивно додати).
e2e: клік на відоме слово відкриває попап зі станом; працює Enter.

### [ ] 8. Practice всередині Quick Check
- Branch: `reader-ux-fixes-08-practice-in-quick-check`
- Base: `reader-ux-fixes-07-click-any-word`
- PR: —

Правка №7. Вправи `fill_blank`, `multiple_choice`, `find_error`, `reorder` стають кроками
`quick-check-steps.ts` / `quick-check.ts` / `QuickCheck.astro` (та сама картка, прогрес, підсумок).
Секція `.exercises`, її стилі та `is:inline` скрипт у `[slugId].astro` видаляються. e2e: секції
Practice немає, кожен тип вправи проходиться у Quick Check, підсумок їх враховує.

### [ ] 9. Study mode v2 — inline-квіз по абзацах
- Branch: `reader-ux-fixes-09-study-mode-v2`
- Base: `reader-ux-fixes-08-practice-in-quick-check`
- PR: —

Правка №5. `reader-study.ts`: для кожного абзацу панель з (а) клікабельними новими словами + Add to
deck, (б) мікро-вправою з `exercises` поста, прив'язаною до блока (компоненти з зрізу 8), (в) recall
due-карток для слів абзацу (`due-cards` + `/partials/card-review`), прогрес "n / N", рахунок; Finish →
підсумок і mark read (зріз 5). Бекенд без змін, якщо exercises не мають індексу абзацу — інакше
опційний `blockIndex` (адитивно, fallback — збіг по словах). e2e: повний прохід study mode.
