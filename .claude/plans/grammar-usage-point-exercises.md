---
slug: grammar-usage-point-exercises
title: Банк вправ і хінт по конкретному usage point у grammar-секції
base_branch: main
created: 2026-09-26
status: in-progress
---

# Банк вправ і хінт по конкретному usage point у grammar-секції

## Контекст

Розпізнавання граматики вже працює на рівні конкретного usage point, а не лише construction'у —
`tag-grammar.handler.ts` тегує кожне речення до конкретного `egpIndex` (наприклад "habits" всередині
Present Simple), це вже видно в `GrammarMatch`. Цей план **не** повторює ту роботу — він додає:

1. Пул перевикористовуваних вправ на кожен usage point (не привʼязаних до конкретного посту/речення,
   на відміну від існуючого `GrammarContrastive`, який будується bespoke під одне речення посту).
2. UI в Reader-попапі, що показує список usage points construction'у з підсвіченим тим, що застосовано
   в цьому реченні (зараз попап показує лише сам застосований usage point, без сусідніх).
3. Кнопку "Practice" біля хінта, що веде на `/grammar/[slug]` з якорем на секцію вправ цього usage
   point.

**Контент вправ генерується поза цим кодом** — в іншій сесії, без виклику AI API з бекенду. Зріз 2
готує лише схему й seed-імпортер; сам seed JSON (~10 вправ на кожен з ~574 usage points) пишеться і
довантажується окремо.

## Зрізи

### [x] 1. Дизайн-перевірка попапу: 3 варіанти списку usage points
- Branch: `grammar-usage-point-exercises-01-popup-design-variants`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/127

Реалізувати всі 3 UI-варіанти на статичних mock-даних всередині Reader popup, обрані query-параметром
для порівняння:
1. Стрічка пігулок знизу (після пояснення), клік перемикає вміст попапу без перезавантаження.
2. Стрічка пігулок зверху (перед поясненням), як швидкий скан перед деталями.
3. Окрема секція-лінк "Усі випадки X →" на `/grammar/[slug]`, без inline-перемикання.

Скріншотити кожен варіант через skill `run`, показати користувачу для вибору. Рішення фіксується тут,
до того як писати реальну логіку в зрізі 4.

**Рішення: варіант 1** (стрічка пігулок знизу, inline-перемикання). Реальні конструкції можуть мати
десятки usage points (EGP "adverbs as modifiers" — 31, легітимні дані, не помилка сидінгу) — стрічка
пігулок має `max-height` + `overflow-y: auto` (вертикальний скрол), а matched usage point завжди
рендериться першим у списку, щоб лишатись видимим без скролу незалежно від кількості siblings.

### [ ] 2. Модель і seed-імпортер для банку вправ на usage point
- Branch: `grammar-usage-point-exercises-02-exercise-bank-seed-import`
- Base: `grammar-usage-point-exercises-01-popup-design-variants`
- PR: —

Нова сутність для пулу вправ, привʼязаних до `grammar_usage_point` (не до `post`, на відміну від
існуючого `Exercise`). Команда за зразком `grammar-import-egp.command.ts`, яка читає seed JSON
(формат: `egpIndex` → масив вправ FillBlank/MultipleChoice/Reorder/FindError) і довантажує в БД лише
ті usage points, де таких вправ ще немає (ідемпотентно, ~10 на usage point). Зафіксувати й
задокументувати формат seed-файлу, щоб окрема сесія, яка генерує контент, знала цільову структуру.

### [ ] 3. Backend query для видачі вправ usage point
- Branch: `grammar-usage-point-exercises-03-usage-point-exercises-query`
- Base: `grammar-usage-point-exercises-02-exercise-bank-seed-import`
- PR: —

Query `get-usage-point-exercises` (або розширення `get-grammar-construction`), що повертає пул вправ
для конкретного usage point.

### [ ] 4. Реалізація обраного варіанту попапу з реальними даними
- Branch: `grammar-usage-point-exercises-04-popup-chosen-variant`
- Base: `grammar-usage-point-exercises-03-usage-point-exercises-query`
- PR: —

Backend: розширити payload Reader'а списком sibling usage points construction'у з позначкою
"matched". Frontend: повна реалізація варіанту, обраного в зрізі 1, з реальними даними; недообрані
варіанти видаляються.

### [ ] 5. Кнопка Practice + секція вправ на `/grammar/[slug]`
- Branch: `grammar-usage-point-exercises-05-practice-button-and-exercises-section`
- Base: `grammar-usage-point-exercises-04-popup-chosen-variant`
- PR: —

Кнопка "Practice" у грамматичній секції попапу веде на `/grammar/[slug]#usage-point-<egpIndex>`. На
сторінці деталей — секція вправ під кожним usage point (`GrammarUsagePoints.astro`), що рендерить пул
із зрізу 3 і дає відповідати на вправи.
