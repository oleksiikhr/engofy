---
slug: posts-list-page
title: /posts — архів і пошук по статтях
base_branch: main
created: 2026-09-13
status: in-progress
---

# /posts — архів і пошук по статтях

Джерело: `prompt.txt` ("Сторінка /posts"). Нова сторінка — архів + самостійний пошук
("посидіти, повибирати"), на відміну від Головної, де систему обирає сама. Працює і
для гостей (без read-стану/персоналізації).

## Залежності

Немає — самодостатній план, не потребує `learning-foundation`. `GET /content/feed`
(Головна) має рівно одного споживача (`apps/web/src/pages/index.astro`) і не
чіпається цим планом — `/posts` отримує власний, новий ендпоінт, бо форма фільтрів
відрізняється (CEFR multi-select, пошук по слову, unread-toggle vs проста пагінація).

## Зрізи

### [ ] 1. Список постів: query + ендпоінт
- Branch: `posts-list-page-01-list-query`
- Base: `main`
- PR: —

Новий `GetPostsListQuery`/handler + `GET /content/posts` (не чіпає `/content/feed`).
CEFR multi-select фільтр, "тільки непрочитане" (LEFT JOIN `post_reads`, застосовується
лише коли є `userId`), курсорна пагінація на `(published_at, id)` через вже наявний,
але досі ніде не використаний `src/core/helpers/cursor.helper.ts`
(`encodeCursor`/`decodeCursor`). Логіка побудови excerpt (`GetFeedHandler.loadExcerpts`)
виноситься в спільний хелпер, перевикористовується обома запитами. `userId` скрізь
опційний (працює для гостей).

### [ ] 2. Фільтр і автокомпліт по слову/фразі
- Branch: `posts-list-page-02-word-search`
- Base: `posts-list-page-01-list-query`
- PR: —

Розширення запиту з зрізу 1 текстовим фільтром, що дзеркалить join
`GetDictionaryQuery.queryUsage` (`sentence_tokens → sentences → posts`), лише в інший
бік (слово → пости, а не пост → слова). Легкий ендпоінт автокомпліту по
`words.lemma`/`phrases.text` (prefix-match) для поля пошуку.

### [ ] 3. /posts — сторінка на apps/web
- Branch: `posts-list-page-03-web-ui`
- Base: `posts-list-page-02-word-search`
- PR: —

Нова `apps/web/src/pages/posts/index.astro`: CEFR-чипси, пошук з автокомплітом,
unread-toggle (прихований для гостей), картки постів (title/excerpt/CEFR-бейдж/
дата/"Прочитано"), курсорне "Показати ще". Функціонально-перший підхід, проста
верстка — візуальний редизайн явно відкладений у `prompt.txt` на окремий прохід, тут
не вигадується. Потребує скріншот у PR за конвенцією репо для user-facing
`apps/web`-фіч. Якщо диф розросся під час реалізації — сигнал перерозбити зріз, а не
продовжувати.
