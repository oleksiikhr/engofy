---
slug: grammar-page-redesign
title: /grammar — персоналізація і хендкрафтові сторінки конструкцій
base_branch: main
created: 2026-09-13
status: in-progress
---

# /grammar — персоналізація і хендкрафтові сторінки конструкцій

Джерело: `prompt.txt` ("Сторінка /grammar"). Список конструкцій уже реалізований
структурно, але повністю анонімний; `/grammar/[slug]` переосмислюється на
хендкрафтові сторінки (код, не шаблон з markdown) з інтерактивним острівцем станів.

**Важливо:** генераційний AI-пайплайн вправ під usage points — окрема майбутня
ітерація, НЕ частина цього плану (і не той самий пайплайн, що `grammar_contrastive`
у `post-detail-redesign` — той бespoke під конкретне речення посту, цей — пул
перевикористовуваних вправ). Цей план лише готує структурний плейсхолдер.

## Залежності

Потребує `learning-foundation` зрізу 2 (ефективний стан 4-станної моделі) для
персоналізації запитів. **Не починати зріз 1, доки `learning-foundation` не
змерджено в `main`.**

## Зрізи

### [ ] 1. Персоналізація grammar-запитів
- Branch: `grammar-page-redesign-01-personalized-queries`
- Base: `main`
- PR: —

`GetGrammarReferenceQuery`/`GetGrammarConstructionQuery` (`src/modules/post/queries/
get-grammar-reference/`, `.../get-grammar-construction/`) отримують **опційний**
`userId` — адитивно, не breaking контракт-зміна (анонімні виклики працюють як
раніше). Коли переданий — джойн через ефективний-стан resolver з
`learning-foundation` зрізу 2 на рівні usage point, згортання в один стан на
конструкцію тим самим принципом "найпросунутіший виграє", що вже є в
`src/modules/post/domain/learning-card-state-priority.ts`, але над 4-станною
моделлю (Новий/Вивчаю/Вивчив/Пропустив) замість чистого FSRS-стану.
`/grammar/[slug]`'s "+ Add to deck" (`apps/web/src/pages/grammar/[slug].astro:80`,
зараз рендериться безумовно) стає умовним від стану.

### [ ] 2. Групування і CEFR-фільтр у списку
- Branch: `grammar-page-redesign-02-grouping-cefr-filter`
- Base: `grammar-page-redesign-01-personalized-queries`
- PR: —

CEFR multi-select фільтр (той самий формат параметра, що вже є) + перемикач
групування: по категорії (поточний дефолт) / по статичному мапуванню
категорія→часовий блок (Past/Present/Future, хардкод у коді, категорії поза цією
віссю → "Інше") / по CEFR. Той самий набір даних, інше групування у відповіді.

### [ ] 3. Фронтенд /grammar (список)
- Branch: `grammar-page-redesign-03-list-page`
- Base: `grammar-page-redesign-02-grouping-cefr-filter`
- PR: —

Редизайн `apps/web/src/pages/grammar.astro`: перемикач групування, CEFR-чипси
(multi-select, узгоджено з патерном на `/posts`/`/practice`), підсвітка стану
конструкції з зрізу 1. Без "приховати вивчене" — усе завжди видно.

### [ ] 4. Каркас /grammar/[slug] + перші хендкрафтові сторінки
- Branch: `grammar-page-redesign-04-slug-shell`
- Base: `grammar-page-redesign-03-list-page`
- PR: —

Перевикористовуваний каркас гібридного рендеру: hero/kicker-верстка, патерн
"Порівняй з" (хардкоджені посилання прямо в розмітці конкретної сторінки, без нової
таблиці зв'язків), інтерактивний острівець usage points, підключений до
персоналізованого запиту з зрізу 1 (+/"Я знаю" на кожен usage point), і
**плейсхолдер-блок вправ на кожен usage point** (лише структура — без генераційного
пайплайну, це окрема майбутня ітерація, не плутати з `grammar_contrastive` з
`post-detail-redesign`). На цьому каркасі — 3-5 повністю хендкрафтових сторінок
конструкцій з різних категорій (перевірити, що каркас тримає різні форми контенту).
**Явно зафіксувати в описі зрізу:** авторство решти ~85-115 сторінок — окремий,
розтягнутий у часі контент-трек на тому самому каркасі, жоден зріз не намагається
закрити це одразу. `cheat_sheet_content` стає незатребуваним цим рендером, лишається
в БД без міграції (можна прибрати пізніше, не зараз).

### [ ] 5. SEO: meta + sitemap
- Branch: `grammar-page-redesign-05-seo`
- Base: `grammar-page-redesign-04-slug-shell`
- PR: —

Per-конструкція meta description (title вже є через `Layout`), генерація
`sitemap.xml` для всіх слагів граматичних конструкцій (наразі в `apps/web` немає
жодної sitemap-інтеграції — нове), фіксується як технічна вимога білду, не
дизайн-рішення.
