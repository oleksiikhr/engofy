---
slug: seo-indexing-improvements
title: Покращення SEO та індексації для apps/web
base_branch: main
created: 2026-09-20
status: in-progress
---

# Покращення SEO та індексації для apps/web

Мета: щоб Google повно й коректно індексував публічний контент (пости, граматика, головна). Стан на
старті: SSR і семантична розмітка є; sitemap містить лише `/grammar*`; немає `robots.txt`, canonical,
OG/Twitter, JSON-LD; усі пости мають однакову meta description; приватні сторінки без `noindex`;
`/posts/{будь-який-slug}-{shortId}` віддає 200 (API парсить лише `shortId`), тобто є дублікати URL.

## Правила виконання

**Обговорення перед кодом (обов'язково для кожного зрізу).** Перед тим як писати чи змінювати
будь-який код зрізу:

1. Прочитати блок «Питання перед кодом» зрізу і перевірити їх проти актуального коду.
2. Додати питання, що виникли під час читання коду (сумнівні місця, неоднозначності, компроміси,
   ризики для вже наявної поведінки).
3. Показати розробнику повний список питань разом із рекомендованою відповіддю до кожного.
4. Дочекатися відповідей. Не починати реалізацію, доки всі питання не закриті; якщо відповідь
   відкриває нове питання — обговорити і його.
5. Зафіксувати прийняті рішення в описі PR зрізу.

Якщо питань немає, прямо сказати про це і все одно дочекатися підтвердження старту.

**Інше.**
- Один зріз на виклик; окремий PR на кожен зріз.
- Публічна origin береться з `PUBLIC_URL` (див. `apps/web/src/pages/sitemap.xml.ts`), не з
  `Astro.url.origin` (за reverse proxy він внутрішній).
- Зміни для `apps/web` перевіряються e2e-тестами Playwright (`apps/web/e2e`) і, де змінюється
  видимий HTML, вручну через `run` skill (перегляд `view-source` — мета-теги мають бути у відповіді
  сервера, а не додані JS).

## Зрізи

### [x] 1. Layout: canonical, robots, OG/Twitter, слот для JSON-LD
- Branch: `seo-indexing-improvements-01-layout-meta`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/99

`Layout.astro` отримує пропси `canonical`, `noindex`, `ogType`, `ogImage` і слот для JSON-LD; додається
хелпер публічної origin (`PUBLIC_URL`). Виводяться `og:title/description/url/type/site_name`,
`twitter:card`, `<link rel="canonical">`, `<meta name="robots">`. `noindex` ставиться на `/login`,
`/profile*`, `/practice`, `/account-deletion/*`, детальні сторінки словника; службові маршрути
(`/partials/*`, `/logout`) віддають заголовок `X-Robots-Tag: noindex`.

Питання перед кодом:
- Якою має бути канонічна origin у dev/test, де `PUBLIC_URL` може бути не заданий: fallback на
  `Astro.url.origin` чи пропуск canonical?
- Чи ставити `noindex` на `/pricing` (є POST-форма, але сторінка публічна) — чи індексувати як
  комерційну сторінку?
- Формат `title`: лишати суфікс `— Engofy` скрізь чи скоротити для довгих заголовків (обрізка ~60
  символів)?
- Чи додавати `noindex` також на сторінки з невалідними/порожніми результатами (`/posts` з помилкою)?
- Дефолтний `og:image` тут (заглушка) чи лише в зрізі 7?

### [x] 2. API: список постів для sitemap
- Branch: `seo-indexing-improvements-02-sitemap-api`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/100

Публічні ендпоінти Nest (`content`) з пагінацією по 50 000: `GET /content/sitemap/posts` (індекс:
`{ pages: [{ page, lastmod }] }`) і `GET /content/sitemap/posts/:page` (`{ items: [{ slug, shortId,
lastmod }] }`, порядок `published_at ASC, id ASC`). Нова колонка `posts.content_updated_at` (ставиться
при публікації) дає `lastmod`. Зміна лише додавальна. Web у зрізі 3 віддає `/sitemap/posts.xml`
(індекс) і `/sitemap/posts-{index}.xml`.

Питання перед кодом:
- Пагінація чи один відповідь: скільки постів очікується (ліміт sitemap — 50 000 URL / 50 МБ)?
- Яка кеш-політика (`@CachePolicy('public')`) і чи потрібен rate-limit для публічного ендпоінта?
- Які пости вважаються опублікованими для sitemap (той самий фільтр, що й `/content/posts`)?
- Що таке `updatedAt` для поста: чи є таке поле в entity, чи використовувати `publishedAt`?
- Нові інтеграційні тести: за конвенціями `engofy` skill (`.ispec.ts`) — чи потрібен e2e?

### [ ] 3. Sitemap і robots.txt
- Branch: `seo-indexing-improvements-03-sitemap-robots`
- Base: `seo-indexing-improvements-02-sitemap-api`
- PR: —

`sitemap.xml` розширюється: `/`, `/posts`, `/pricing`, граматика, усі пости з `<lastmod>`. Додається
динамічний `robots.txt` (з `PUBLIC_URL`) із директивою `Sitemap:` і `Disallow` для `/api/`,
`/partials/`, `/login`, `/logout`, `/profile`, `/practice`, `/account-deletion`.

Питання перед кодом:
- Що робити, якщо web задеплоїться раніше за API і нового ендпоінта ще немає (помилка sitemap чи
  часткова відповідь без постів через `apiGetOrNull`)? Деплой — окремий `v*` тег.
- Sitemap index одразу чи один файл, доки постів мало?
- `robots.txt` статичний файл чи динамічний маршрут (origin береться з `PUBLIC_URL`)?
- `Disallow` не забороняє індексацію за наявності зовнішніх посилань — чи покладатися на `noindex` зі
  зрізу 1, і чи не суперечать вони одне одному (заблокований в robots URL не читає `noindex`)?
- Кеш `cache-control` для sitemap (зараз 1 год) — лишити?
- Що робити з `/dictionary` у sitemap (вимагає логіну)?

### [ ] 4. Сторінка поста: description, OG article, Article JSON-LD, BreadcrumbList
- Branch: `seo-indexing-improvements-04-post-meta`
- Base: `seo-indexing-improvements-03-sitemap-robots`
- PR: —

Кожен пост отримує унікальну meta description, `og:type=article`, `article:published_time`,
`article:tag` (CEFR), JSON-LD `Article` (headline, datePublished, inLanguage, educationalLevel,
`isBasedOn` з `sourceLink`, `publisher`) і `BreadcrumbList` (Home → Posts → пост).

Питання перед кодом:
- Джерело description: перший абзац тексту (детерміновано) чи нове AI-поле `summary` (зміна
  пайплайну, це контракт backend↔web і окремий зріз)?
- `sourceType` не `original`: чи безпечно віддавати уривок тексту в description з погляду ліцензії
  й атрибуції?
- Чи відображати `author`/`publisher` у JSON-LD і що вказувати як `publisher` (Organization Engofy)?
- `dateModified`: чи є оновлення тексту постів, чи достатньо `datePublished`?
- Що з `og:image` для поста: дефолтна картинка, чи генерована (окремий зріз)?

### [ ] 5. Канонічний URL поста (301)
- Branch: `seo-indexing-improvements-05-post-url-redirect`
- Base: `seo-indexing-improvements-04-post-meta`
- PR: —

`/posts/{shortId}` і `/posts/{хибний-slug}-{shortId}` редіректяться (301) на канонічний
`/posts/{slug}-{shortId}` (`postUrl`). Query-параметри (`?from=home`) зберігаються; canonical у
`<head>` завжди канонічний.

Питання перед кодом:
- 301 чи 308, і чи можливі вже опубліковані посилання на старі URL (у листах, шерингу)?
- Пост без slug (`slug: null`): канонічний URL — `/posts/{shortId}`?
- Чи змінювався slug поста після публікації (зміна заголовка) — що тоді вважати канонічним?
- Регістр і кодування: як обробляти `/posts/Slug-ABC123` і незвичні символи?
- Чи не зламає редірект Playwright-тести й `partials` (`hx-get`, `?from=home`)?

### [ ] 6. Публічні сторінки: title, description, canonical для фільтрів
- Branch: `seo-indexing-improvements-06-public-pages-meta`
- Base: `seo-indexing-improvements-05-post-url-redirect`
- PR: —

Головна отримує змістовний title і description, `WebSite`/`Organization` JSON-LD і для анонімів
внутрішні посилання на свіжі пости й граматику. `/posts` і `/grammar` отримують свої title і
description; варіанти з фільтрами та `cursor` мають canonical на базову сторінку. Граматика
отримує `BreadcrumbList`.

Питання перед кодом:
- Точне формулювання title/description головної (англійською; ключові слова, цільова аудиторія)?
- Чи `noindex,follow` для сторінок фільтрів чи достатньо canonical на базову?
- `/dictionary` у публічній навігації веде на логін: відкрити анонімам, прибрати з меню чи лишити?
- Скільки й яких постів показувати на головній для анонімів (нові, за рівнями CEFR)? Це додатковий
  запит до API на кожен показ головної.
- Чи потрібне `hreflang`, якщо сайт англомовний для україномовної аудиторії (одна мова — можна без)?

### [ ] 7. Іконки, manifest, OG-зображення за замовчуванням
- Branch: `seo-indexing-improvements-07-icons-manifest`
- Base: `seo-indexing-improvements-06-public-pages-meta`
- PR: —

PNG/ICO favicon (Google Search краще показує їх), `apple-touch-icon`, web manifest, `theme-color`
і дефолтне `og:image` (1200×630).

Питання перед кодом:
- Звідки береться графіка: чи є вихідник логотипа, чи генерувати з `favicon.svg`?
- Чи потрібен `theme-color` для світлої й темної тем (`prefers-color-scheme`)?
- Чи потрібні PWA-можливості (service worker) чи manifest лише для метаданих?
- Формат і розмір OG-картинки; статична для всього сайту чи по одній на рівень CEFR?
- Оптимізація скріншотів у `public/landing` (WebP/AVIF) — у цьому зрізі чи окремо?
