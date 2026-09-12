# English Reader — технічний спек (MVP)

Сервіс для вивчення англійської мови через короткі автентичні тексти (2-3 абзаци),
з автоматичним граматичним та лексичним розбором, вправами та інтервальним повторенням.

Цільова аудиторія: люди, які хочуть вчити англійську "між справами", маленькими
порціями контенту, без відчуття, що це урок.

---

## 1. Технологічний стек

| Компонент | Технологія | Призначення |
|---|---|---|
| Backend | NestJS | REST API |
| Background jobs | NestJS worker + `@Cron` | обробка текстів, telegram polling |
| CLI | NestJS CLI (nest commander) | одноразові скрипти, імпорт EGP-даних |
| Frontend | Astro + HTMX | SSR-сторінки, мінімум клієнтського JS |
| DB | PostgreSQL | основне сховище |
| Cache/queue | Redis | rate limiting, сесії гостей, feed-стан |
| NLP | spaCy (Python, окремий сервіс або CLI-виклик) | POS, lemma, morphology, dependency parsing |
| AI | Claude API | складність тексту, класифікація граматики (usage), генерація вправ |
| SRS | ts-fsrs (алгоритм FSRS) | інтервальне повторення слів/фраз/граматики |

**Примітка щодо spaCy:** оскільки основний бекенд на NestJS (Node.js), а spaCy — Python,
потрібен окремий легкий Python-сервіс (FastAPI/Flask) або виклик через child_process/CLI
з NestJS worker. Рекомендація: окремий маленький HTTP-сервіс `nlp-service`, який приймає
текст і повертає токенізацію — простіше масштабувати й тестувати ізольовано.

---

## 2. Ролі користувачів

| Роль | Доступ |
|---|---|
| Гість (не залогінений) | Читає всі статті, бачить усі tooltip, граматику, вправи. Не може зберігати прогрес. |
| Зареєстрований (free) | Все те саме + може додавати слова/фрази/граматику в SRD-чергу, ліміт **100 карток** сумарно. |
| Premium ($4.99/міс) | Без обмежень по кількості карток. (V1: оплата не знімається реально — мок-флоу, див. розділ 8) |

Реєстрація виникає в момент першої дії, що потребує збереження стану (натискання "+" на
слові) — не раніше, попапом поверх поточної сторінки.

---

## 3. Схема бази даних (PostgreSQL)

### 3.1 Користувачі та авторизація

```sql
users
  id, email, google_sub (nullable), created_at

auth_sessions
  id, user_id, token, expires_at, created_at

auth_challenges          -- passwordless OTP через email
  id, email, otp_hash, attempts, requested_at, expires_at

subscriptions
  id, user_id, plan (free|premium), status (active|expired),
  started_at, current_period_end, is_mock_payment (boolean, default true)
```

### 3.2 Контент (статті)

```sql
posts
  id, title, slug, source_link, source_raw_text,
  source_type (original|excerpt|reddit_comment|news_snippet),
  attribution_text,                    -- як коректно вказати джерело на сторінці
  status (pending|processing|published|failed),
  cefr_level, published_at, created_at

sentences
  id, post_id, position, raw_text, cefr_level

sentence_tokens
  id, sentence_id, position, text, lemma, pos, tag, dep, morph_json,
  phrasal_verb_group_id (nullable, FK -> phrases.id),
  is_gerund (boolean), is_idiom_part (boolean),
  word_id (nullable, FK -> words.id),
  phrase_id (nullable, FK -> phrases.id)

grammar_matches
  id, sentence_id, grammar_usage_point_id, confidence,
  token_start, token_end
```

### 3.3 Лексика

```sql
words
  id, lemma, frequency_rank        -- пост-рев'ю: cefr_level НЕ тут, а на word_definitions (per-POS)

word_definitions
  id, word_id, pos, definition, example, cefr_level

phrases
  id, text, type (phrasal_verb|idiom|collocation), definition, cefr_level

post_word
  id, post_id, word_id

post_phrase
  id, post_id, phrase_id
```

Список неправильних дієслів (~200 шт) — **не в БД**, статичний JSON-файл у коді
(`assets/irregular-verbs.json`: base_form, past_simple, past_participle, cefr_level).
Базова форма лінкується як звичайне слово через `words.lemma`.

### 3.4 Граматика (на основі Cambridge English Grammar Profile)

Джерело: https://englishprofile.org (EGP, 1239 записів). Імпортуються лише
`USE`- та `FORM/USE`-записи (~574 з 1239) — чисто формальні (`FORM:`) пункти
стають статичним контентом шпаргалки, а не окремими SRS-одиницями.

```sql
grammar_categories        -- 19 верхніх категорій (PRESENT, MODALITY, PASSIVES...)
  id, name, sort_order

grammar_constructions      -- ~90 конструкцій (present simple, going to...)
  id, category_id, name, slug,
  cheat_sheet_content (markdown, включно з розділом Form: affirmative/negative/questions),
  sort_order

grammar_usage_points       -- ~574 USE / FORM+USE записи з EGP
  id, construction_id, cefr_level,
  guideword,               -- напр. 'USE: HABITS AND GENERAL FACTS'
  can_do_statement,
  example_text
```

### 3.5 Spaced Repetition (FSRS)

Одна уніфікована таблиця для слів, фраз і граматики — не три окремі:

```sql
learning_cards
  id, user_id,
  word_id (nullable, FK -> words.id),
  phrase_id (nullable, FK -> phrases.id),
  grammar_usage_point_id (nullable, FK -> grammar_usage_points.id),
  due, stability, difficulty, elapsed_days, scheduled_days,
  reps, lapses, state (new|learning|review|relearning), last_review,
  created_at,
  CHECK (
    (word_id IS NOT NULL)::int +
    (phrase_id IS NOT NULL)::int +
    (grammar_usage_point_id IS NOT NULL)::int = 1
  )

review_logs
  id, card_id, rating (again|hard|good|easy),
  reviewed_at, elapsed_days, scheduled_days
```

Ліміт карток (100 для free) рахується як `COUNT(*) FROM learning_cards WHERE user_id = ?`,
без розділення по типу.

### 3.6 Skills / прогрес

```sql
user_skill_progress
  id, user_id, construction_id,
  mastery_score (0-100), correct_streak,
  total_attempts, correct_attempts,
  unlocked_at (nullable)
```

`mastery_score` агрегується з усіх `learning_cards`, де `grammar_usage_point_id`
належить цій `construction_id`.

### 3.7 Pipeline обробки текстів

```sql
post_processing_jobs                 -- у коді: PostPipelineRun, unique (post_id, stage)
  id, post_id,
  stage (spacy_parse|annotation|ai_complexity|ai_grammar|ai_exercises|publish),
  status (pending|done|failed),       -- "running" не зберігається: derived = started_at ∧ !completed_at
  error_message, started_at, completed_at, retry_count
```

> Пост-рев'ю (2026-08-30): стейдж `fetch` прибрано (V1 приймає тільки вставлений
> текст, не URL — D7). `started_at`/`error_message`/`retry_count` + `PostStatus.Failed`
> ще не пишуться на фейлі — фікс D4 в `.claude/skills/engofy/REVIEW.md`.

### 3.8 Публікація на зовнішні канали

```sql
post_publications
  id, post_id, platform (telegram|twitter|facebook|ios_push|android_push),
  external_id, status (pending|published|failed),
  published_at, error_message
```

### 3.9 Адмін-бот (Telegram, керування через повідомлення)

```sql
telegram_updates
  id, update_id (bigint unique), raw_payload,
  processed (boolean), created_at
```

NestJS `@Cron` кожну хвилину викликає Telegram `getUpdates`, фільтрує повідомлення
за твоїм `telegram_user_id` (з конфігу/env, без окремої таблиці адмінів), парсить
команди (`/add <text>`, `/retry {post_id}`). `/add` бере **вставлений текст** (не
URL — D7): створює `posts` і ставить джобу `post-spacy-parse`.

### 3.10 Вправи (згенеровані з тексту)

```sql
exercises
  id, post_id, type (fill_blank|find_error|multiple_choice|comprehension|reorder),
  payload_json,        -- питання, варіанти, правильна відповідь
  source (spacy|ai)     -- більшість генерується без AI (детерміновано з sentence_tokens)
```

---

## 4. Сторінки сайту

| Маршрут | Опис |
|---|---|
| `/` | Стрічка: одразу відкрита остання неопрацьована стаття або swipe-стрічка карток. Кожні 2-3 статті — вставляється картка повторення слів/граматики замість наступної статті. |
| `/posts/{slug}-{id}` | Текст з інлайн-розбором: підсвітка POS/граматики, tooltip на слові/конструкції, кнопка "+" на кожному слові, вправи та comprehension-питання внизу. |
| `/practice` | Загальна SRS-черга (слова + фрази + граматика разом), оцінка Again/Hard/Good/Easy. |
| `/grammar` | Довідник: 19 категорій → 90 конструкцій, фільтр по CEFR, шпаргалка + список USE-пунктів. |
| `/dictionary` | Особистий словник користувача: усі картки, статус (new/learning/review), пошук, у яких статтях слово зустрічалось. |
| `/profile` | Прогрес: skills-дерево (90 конструкцій, unlocked/locked), streak, статистика по CEFR. |
| `/login` | Email + OTP (2 кроки), кнопка "Продовжити з Google" (google_sub вже закладено в схему). |
| `/pricing` | Опис Premium ($4.99/міс), кнопка "Оплатити" → мок-флоу видає підписку без реального списання. |

Адмінки як окремого веб-розділу немає — управління повністю через Telegram-бота.

---

## 5. Пайплайн обробки тексту (post_processing_jobs)

Вхід — вставлений текст (`PostService.ingest({ rawText })`). Стейджу `fetch` немає
(V1 не тягне URL — D7). Далі:

1. **spacy_parse** — токенізація, POS, lemma, morphology, dependency parsing →
   `sentences` / `sentence_tokens`. На завершенні — **fan-out** на дві незалежні гілки:
2a. **annotation** — тонкий AI-шар над spaCy: детерміновані слова/фразові дієслова
    зі spaCy + LLM лише для ідіом/колокацій → node-tree spans + `sentence_tokens.word_id`/`phrase_id`
2b. **ai_complexity** — CEFR-рівень тексту + кожного речення (Claude API)
3. **ai_grammar** — (після `ai_complexity`) класифікація по закритому списку 90
   `grammar_constructions` + `grammar_usage_points` → `grammar_matches`
4. **ai_exercises** — детерміновані вправи з `sentence_tokens` + один AI-виклик на comprehension
5. **publish** — `posts.status = published`, upsert `post_publications` (V1: тільки telegram).
   Пост-рев'ю: має чекати на завершення гілки `annotation` (D6).

Кожен стейдж — окрема ідемпотентна pg-boss джоба, ключ ідемпотентності —
`PostPipelineRun (post_id, stage) = Completed`. Наступний стейдж ставить хендлер,
що завершив попередній. Керується/перезапускається командами в Telegram-боті
(`/retry` = повний reprocess з нуля — D5).

---

## 6. Формат inline-розмітки (LLM-вивід перед парсингом)

Використовується замість JSON, щоб зменшити галюцинації моделі на довгих текстах.

```
She felt strangely ⟦at home⟧{{p|idiom|at home|g1}} in a city she
⟦had never visited⟧{{g|present-past-perfect|42}} before.
```

Роздільники — рідкісні `⟦` `⟧` (U+27E6/7) + `{{…}}`. Парсер відновлює офсети,
звіряючи знятий текст із оригіналом символ-у-символ (`isComplete`); неповний
вивід → 1 ретрай тим самим промптом.

> Пост-рев'ю (2026-08-30 — D13): PUA-escaping `[` `]` `{` `}` (як планувалось
> раніше) **не реалізовано** й не потрібне з новими роздільниками. Літеральні
> `⟦`/`⟧`/`{{…}}` у самому тексті не підтримуються — трапляються рідко,
> деградує до часткової анотації.

Розбір фразових дієслів з розривом (`picked her sister up`) і герундія робиться
детерміновано через spaCy (`tag=RP`/`dep=prt` для частки, `tag=NN` + `-ing` + перевірка
залежності — для герундія); LLM підключається тільки для ідіом і колокацій, яких spaCy
не розпізнає структурно.

---

## 7. Rate limiting (Redis)

- OTP-запит: ліміт по IP (`otp:ip:{ip}`) **і** по email (`otp:email:{email}`) окремо,
  з TTL — обидва ключі потрібні, бо кожен закриває інший вектор зловживання
- Feed-сесія гостя: лічильник переглянутих статей у сесії (`session:{cookie_id}:articles_seen`)
  для чергування "стаття → повторення → стаття" без БД
- Загальний API rate-limit (per-IP, стандартний NestJS throttler) на публічні ендпоїнти

---

## 8. Монетизація (V1 — мок)

Кнопка "Оплатити" на `/pricing` не інтегрована з реальним платіжним провайдером:
за натисканням створюється запис у `subscriptions` з `plan=premium`,
`is_mock_payment=true`, `current_period_end = now() + 1 month`. Структура таблиці
вже готова для підключення Stripe/іншого провайдера пізніше (додати `payment_provider`,
`external_subscription_id` як nullable-колонки).

---

## 9. Авторські права на контент

Тексти — короткі уривки (кілька абзаців): фрагмент книги, коментар з Reddit, витяг з
новини, або оригінальний текст. Для кожного `posts` обов'язково зберігати
`source_link` і показувати `attribution_text` на сторінці статті. Уникати публікації
повних статей цілком — тільки короткі витяги з чітким посиланням на оригінал.

---

## 10. Явно поза межами V1 (наступні ітерації)

- AI-компаньйон для розмови по темі статті (генерація промпту + ведення діалогу) —
  потребує окремого рішення щодо архітектури (проксі через власний AI API vs
  просто згенерований текст промпту для стороннього чат-боту)
- Реальна інтеграція оплати (Stripe/інше)
- Публікація в Twitter/Facebook/мобільні push (структура `post_publications` вже
  закладена, самі інтеграції — пізніше)
- Розширення класифікації граматики за межі 90 базових конструкцій
- Розділення лімітів SRD-карток по типу (зараз єдиний ліміл 100 на всі типи разом)

---

## 11. Довідкові джерела даних

- Cambridge English Grammar Profile (EGP): https://englishprofile.org — 1239 записів,
  копія у форматі Excel: https://github.com/ninja33/EGP (`asset/egpo.xlsx`)
- spaCy: https://spacy.io — POS/lemma/dependency parsing, модель `en_core_web_sm`
- ts-fsrs: https://github.com/open-spaced-repetition/ts-fsrs — SRS-алгоритм
- wordfreq (Python) — частотність слів для `words.frequency_rank`

---

# Частина II — виконання

Розділи 1–11 вище — **цільова специфікація** (що будуємо). Розділи 12–16 нижче
фіксують рішення й хронологію виконання. **Усі 10 вертикальних зрізів (§14)
завершені й змержені в `main`** як squash-commit `a4b9e1a` "V2 (#1)" — гілки
`v2` більше не існує, поточна робоча гілка — `fix/local-verification` (деталі
в пам'яті сесії `content_pivot_plan`). §14 нижче навмисно стислий — це
історичний чекліст статусів, не покроковий журнал; повна хронологія кожного
зрізу лишається в тій самій пам'яті, не в цьому файлі.

---

## 12. Зафіксовані рішення (не перевідкривати)

Перенесено зі старого `PLAN.md` (розділ «Working notes» у git-історії) — усе це
досі чинне — плюс рішення, ухвалені при переході на новий спек.

- **offset-splice / all-or-nothing.** AI повертає char-offset; код валідує
  `text[start:end] === form` до будь-якого запису; одна погана анотація завалює
  всю джобу — жодних часткових записів.
- **AI ніколи не на HTTP-шляху** — тільки у pg-boss воркерах.
- **Кожен стейдж пайплайну — окрема ідемпотентна pg-boss джоба.** Перевір
  наявність результату перед викликом AI («gap-filler, not rewrite»).
  Ідемпотентність = «чи є вже `done` рядок для (цей post, цей стейдж)» у
  `post_processing_jobs`, а не «чи є результат десь в іншій таблиці» (для
  grammar-tagging інакше не визначити).
- **Flush по одній `PostPart`** в анотаційній джобі — краш посеред джоби не
  втрачає весь прогрес; part із проставленим `annotatedAt` пропускається при
  ретраї. `AnnotatePostHandler` свідомо порушує конвенцію «handler не робить
  flush» саме заради цього.
- **node-tree + spaCy — два паралельні шари** над одним примітивом (`PostPart`
  plain-текст + char-offset):
  - node-tree (`doc/paragraph/text/span` + `ListBlock`, heading level,
    `LinkNode`, `marks`) — шар рендеру/форматування; несе word/phrase/grammar
    span через `spliceSpans`.
  - spaCy `sentences` / `sentence_tokens` — аналітичний шар (POS/lemma/morph/
    dep), прив'язаний до `post_part_id` + char-offset у plain-тексті тієї ж
    `PostPart`.
  - Шари зустрічаються на `Word` / `Phrase` через FK — прямий лінк
    token ↔ span не потрібен. `grammar_matches` → `sentence_id` + діапазон
    токенів.
- **Розрив фразових дієслів і герундій — детерміновано через spaCy**
  (`tag=RP` / `dep=prt` для частки; `-ing` + перевірка залежності для
  герундія), не через LLM. LLM підключається лише для ідіом/колокацій, які
  spaCy структурно не розпізнає.
- **inline-markup формат** для виводу LLM замість JSON — менше галюцинацій на
  довгих текстах. Роздільники — рідкісні `⟦` `⟧` (U+27E6/7) + `{{…}}`
  (`⟦span⟧{{g|slug|egpIndex}}` для граматики, `⟦…⟧{{p|type|canon|gN}}` для
  ідіом). Модель повертає текст дослівно + теги; парсер звіряє знятий текст із
  оригіналом символ-у-символ. **PUA-escaping `[]{}` НЕ реалізовано** (D13) —
  літеральні `⟦⟧`/`{{}}` у тексті не підтримуються (трапляються рідко).
  Реалізація: `domain/parse-annotation-tags.ts`, `domain/parse-grammar-tags.ts`,
  `domain/grammar-prompt.ts`.
- **spaCy живе окремим HTTP-сервісом** (`nlp-service`, FastAPI +
  `en_core_web_sm`), не через `child_process` — простіше масштабувати й
  тестувати ізольовано.
- **Список неправильних дієслів — не в БД**: статичний
  `assets/irregular-verbs.json` (`base_form`, `past_simple`,
  `past_participle`, `cefr_level`); базова форма лінкується як звичайне слово
  через `words.lemma`.
- **З EGP імпортуються тільки `USE` та `FORM/USE` записи** (~574 з 1239) як
  SRS-одиниці; чисто `FORM:` пункти — статичний контент шпаргалки
  (`grammar_constructions.cheat_sheet_content`), не окремі одиниці.
- **Ліміт карток (100 для free)** рахується як
  `COUNT(*) FROM learning_cards WHERE user_id = ?`, без розбивки за типом.
- **Адмінки як веб-розділу немає** — керування контентом лише через
  Telegram-бота.

---

## 14. Вертикальні зрізи

Порядок: дані → парсинг → AI → навчання → UI. Кожен зріз тестується через
CLI/API ще до появи фронтенду. **Усі 10 — DONE, змержені в `main`**
(`a4b9e1a`). Нижче — статусний чекліст, не журнал; повна хронологія (файли,
рішення, edge-кейси) — у пам'яті сесії `content_pivot_plan.md`.

- [x] **Зріз 0 — підготовка.** Прибрано `entrypoints/cron/scraper/`;
      `content`→`post` rename підтверджено завершеним; `draft/` (grammar-eval
      harness) лишено.
- [x] **Зріз 1 — дані-фундамент.** Міграції під усі таблиці розділу 3
      (`subscriptions`, spaCy-шар `Sentence`/`SentenceToken`, grammar-модель,
      FSRS `LearningCard`/`ReviewLog`, `UserSkillProgress`, `Exercise`,
      `PostPublication`, `TelegramUpdate`, 7-стейджовий `PostPipelineStage`) +
      статичні asset-и (`irregular-verbs.json`, `egp.json` → 19 кат/90
      конструкцій/574 usage points, `word-frequency.txt`) з CLI-імпортерами.
- [x] **Зріз 2 — nlp-service + стейдж `spacy_parse`.** `nlp-service/`
      (FastAPI + spaCy `en_core_web_sm`), `NlpClient` порт, стейдж
      `spacy_parse` → `Sentence`/`SentenceToken`; фразові дієслова й герундій —
      детерміновано (`domain/build-sentences.ts`).
- [x] **Зріз 3 — AI-стейджі поверх spaCy.** `ai_complexity`, `ai_grammar`
      (inline-markup формат, §6/§12), rework `content_annotation` (spaCy дає
      POS/lemma, AI — лише ідіоми/колокації). Grammar eval baseline #3: 7/7
      isComplete, $1.63. `words.cefr_level` лишається на `WordDefinition`
      (per-POS, D12).
- [x] **Зріз 4 — вправи + публікація статусу.** Детерміновані `exercises`
      (`domain/build-exercises.ts`) + AI comprehension; стейджі `ai_exercises`
      та `publish`.
- [x] **Зріз 5 — Telegram адмін-бот.** `modules/telegram/`, `/add <text>` та
      `/retry <id>`, cron-опитування `getUpdates`, cron-публікація в канал.
- [x] **Зріз 6 — SRS (FSRS) + монетизація.** `modules/learning/` (`ts-fsrs`,
      `/learning/*` API, ліміт 100 карток) + `modules/billing/` (мок
      `POST /billing/subscribe`).
- [x] **Зріз 7 — skills / прогрес.** `user_skill_progress` write-path,
      `mastery_score` за FSRS-стабільністю (не correct/total), `streak`
      виведений з `review_logs`, `GET /profile` — один агрегат.
- [x] **Зріз 8 — фронтенд (Astro + HTMX).** Окремий пакет `apps/web/`
      (Astro 7 + Tailwind v4 + htmx), reverse-proxy `/api/*` → Nest. Усі 8
      сторінок + спільна e2e-seed інфраструктура
      (`test/e2e/seed-web-e2e.ts`), 29 Playwright-тестів.
- [x] **Зріз 9 — Redis-поліш.** OTP rate-limit окремо по IP і по email (один
      Lua-скрипт, спільне вікно).

---

## 15. Прибирання

- ~~`src/entrypoints/cron/scraper/`~~ — видалено (зріз 0).
- ~~`new/asd.py` + `new/requirements.txt`~~ — перенесено в `nlp-service/`
  (`app.py` + pinned `requirements.txt`), `new/` прибрано з кореня (зріз 2).
- `draft/` — лишається як eval-харнес; тримати синхронним із реальним
  пайплайном.
- Старий закомічений `PLAN.md` (розділ «Working notes») — джерело для
  розділу 12; після переносу цінності не має.

---

## 16. Рідер v2 — «Editorial & Margin Notes» (сесія 2026-09-12, ще не заскоуплено в зрізи)

Дизайн-напрямок обрано в окремій сесії (Claude Design canvas, мокапи не
додаються до репо): редакторська типографіка (serif заголовок + тіло), тепла
нейтральна палітра. **Інлайн-підсвітка слів/фраз/граматики в тексті статті
прибирається повністю** — заміна поточного «wall of highlighter»
(word-спани + F3 grammar-paint, ~60-140 фрагментів на пост, див.
`content_pivot_plan` → «Live UI review»). Продуктові рішення цієї сесії:

- **Сайдбар «У цій статті»** — персистентний, згрупований за типом
  (Граматика / Слова / Фрази, з лічильниками), показує лише унікальні
  конструкції/слова, не всі входження. Мітка знаю/вчу/нове = `learning_cards.state`
  (`new`, якщо картки ще нема) — без окремої per-article метрики розуміння
  (FSRS-стан лишається єдиним джерелом істини, дублювати його «чи впізнав
  саме тут» — over-engineering для MVP). Клік по пункту **не** скролить/
  підсвічує місце в тексті — свідомо не робимо, бо вимагало б лишити
  координати спанів, яких прибираємо. Грамат-пункти ведуть на
  `/grammar/{slug}` (контент уже є з EGP-імпорту, §3.4); слово-/фразо-пункти
  лишаються без preview-визначення, доки не з'явиться enrichment (нижче).
- **Comprehension quiz** — одразу після статті, **не блокує** перехід до
  наступної (продукт позиціонується як «не урок», рядок 7). Не звʼязаний з
  SRS напряму — не породжує картки автоматично, лишається незалежним
  passage-рівня сигналом (як і зараз, `exercises.type=comprehension`). Факт
  проходження (незалежно від правильності відповідей) трекається як
  внутрішній прапорець «стаття прочитана» для дедуплікації у фіді — не
  показується користувачу як оцінка.
- **Прогрес у рідері** — лише day streak у хедері + один текстовий рядок
  одразу після quiz («+2 нові слова · 1 конструкція вчиться»), без цифрових
  віджетів/дашборду на самій сторінці читання. `/profile` лишається окремим
  місцем для агрегатів (mastery, CEFR-розподіл, skills-дерево).
- **Режиму «просто читати» (Read/Study toggle) не додаємо** — сайдбар
  згортається per-сесія (простий collapse), не через окремий глобальний
  режим; сама відсутність інлайн-підсвітки вже знімає проблему нав'язливості.
- **Feed-механіка переглядається**: рядок §4 «кожні 2-3 статті — картка
  повторення замість наступної статті» замінюється м'яким нагадуванням/
  бейджем «N due» замість примусової вставки картки в стрічку — FSRS
  due-дата вже сама регулює, коли повторення потрібне; форсована частота
  works against цю логіку і ризикує зламати «між справами»-позиціонування.
- **Ревізія 8 сторінок**: 7/8 підтверджені як такі, що напряму відповідають
  на «чи стає користувач кращим» (practice/profile/dictionary/grammar+
  construction/reader; pricing — легітимна бізнес-сторінка, не навчальна, але
  й не UI-обвіс). Єдина механіка під сумнівом — примусовий feed-інтерстишл
  вище.
- **Enrichment-джоба (word/phrase definition) — наступний пріоритетний
  build-слайс**, паралельно або одразу слідом за фронтенд-переробкою рідера,
  не в довгу чергу. Без неї 2 з 3 категорій сайдбара, `/dictionary` і
  `/profile` «cards by level» лишаються порожніми — найбільша лишкова
  продуктова прогалина, підтверджена і live UI review (2026-09-06), і цією
  дизайн-сесією.

Нічого з цього розділу ще не в коді й не розбито на вертикальні зрізи (§14) —
робити це окремим проходом, коли починаємо фронтенд-реалізацію.

---

## 17. Рідер v2 — вертикальні зрізи (з §16)

Два незалежні, але пов'язані треки. За рішенням §16 йдуть **паралельно, або
enrichment прямо перед фронтенд-переробкою** — не після. Порядок нижче в межах
кожного треку — дані → бекенд → фронтенд/CLI, як у §14; між треками зрізи
можна чергувати.

**Зафіксовано цією сесією** (консультація зі скілом `engofy` + підтвердження):
- Enrichment — **пайплайн-стейдж**, не окрема cron-джоба: `annotate-post.handler.ts`
  вже find-or-creates stub `WordDefinition` (per word+POS) і `Phrase` рядки на
  кожному пості з `definition = NULL` — новий стейдж ганчиться на завершенні
  `annotation`, гейтується через `PostPipelineRun` як будь-який інший (P2/P3).
- `publish` **гейтиться і на цей стейдж** — той самий механізм, що D6
  (`annotation`) і F3 (`ai_grammar` paint-фаза): пост не йде в публікацію, поки
  всі його слова/фрази не мають визначення.
- "Прапорець прочитано" для дедупу у фіді — **реальна таблиця** `post_reads`,
  не Redis-сесія (яка вже покриває інший кейс — гостьовий лічильник §7) —
  дешева база на майбутнє, той самий підхід, що й для будь-якого іншого
  per-user стану. **Виправлення (B5)**: тоді здавалося, що форсований
  feed-інтерстишл із §4 ніколи не був реалізований (`get-feed.handler.ts`
  справді не має логіки чергування) — але він **був реалізований на
  фронтенді** (`apps/web/src/pages/index.astro`, `ARTICLES_PER_BREAK`), про
  що зʼясувалося аж при виконанні B5. `post_reads` як groundwork все одно
  лишається правильним рішенням незалежно від цього факту.

### Трек A — Enrichment job (word/phrase definitions)

- [x] **Зріз A1 — промпт + AI-виклик.** `post/domain/enrichment-prompt.ts` —
      `completeStructured` з zod tool-схемою (не inline-markup): масив
      `{ index, definition, phonetic, example, cefrLevel }` для слів +
      `{ index, definition, example, cefrLevel }` для фраз, індексно
      прив'язаних до переданого списку pending-цілей (`indexEnrichmentResult`,
      all-or-nothing як `indexComplexityLevels`). Unit-тести
      `enrichment-prompt.spec.ts`.
- [x] **Зріз A2 — стейдж `enrichment` у пайплайні.** `PostPipelineStage.Enrichment`
      + міграція `Migration20260912095251` (CHECK-констрейнт), черга
      `post-ai-enrichment`, воркер (`entrypoints/worker/post/enrich-lexicon.
      {processor,module}.ts`), команда `post/commands/enrich-lexicon/`.
      `AnnotatePostHandler` ганчить його на завершенні (третя гілка поряд з
      `ai_complexity`). Робота — gap-fill за рядками (P6-стиль): бере
      `wordDefinitionId`/`phraseId` з node-tree spans (як `get-post-detail`),
      фільтрує `definition IS NULL`, 0 AI-викликів якщо пусто.
      `PublishPostHandler` гейтиться і на `Enrichment`, і на `Annotation`.
      Integration-тести `enrich-lexicon.handler.ispec.ts` +
      оновлені `publish-post`/`annotate-post` ispec на новий гейт/enqueue.
      818→824 тестів, `migration:check` чистий. **Живий смоук проти реального
      Anthropic API пройдено** (worker + nlp-service локально, один вигаданий
      пост через увесь 7-стейджовий пайплайн): 18 слів + 6 фраз заповнено
      якісними визначеннями/прикладами/CEFR за один виклик, $0.0206,
      публікація пройшла (обидва гейти — annotation і enrichment).
- [x] **Зріз A3 — backfill CLI.** `post/commands/backfill-enrichment/` +
      CLI `engofy post backfill-enrichment` — ставить у чергу `enrichment`
      для всіх `published` постів без `Completed`-рядка. Integration-тести
      `backfill-enrichment.handler.ispec.ts`.
- [x] **Зріз A4 — eval-харнес.** Розширення `draft/` (як для grammar,
      `draft/lib/*` + `draft/scripts/{run,snapshot,compare}-enrichment.ts`).
      На відміну від idiom/grammar харнесів — без локальних content-фікстур:
      стейдж працює над `WordDefinition`/`Phrase`, які `annotate-post` вже
      резолвнув на реальному пості, тож харнес читає їх напряму зі standalone
      MikroORM-конекшену до dev-БД (`lib/load-post-lexicon.ts`, той самий
      патерн, що й `test/e2e/seed-web-e2e.ts`; read-only), а не намагається
      відтворити find-or-create без БД. `lib/call-claude-structured.ts` —
      прямий еквівалент `AnthropicClientService.completeStructured`.
      Baseline `draft/baselines/enrichment-sonnet-5.json`: усі 9 `published`
      постів у dev-БД, 314 слів + 35 фраз, 0 incomplete, 0 truncated,
      $0.2663.

### Трек B — Рідер фронтенд «Editorial & Margin Notes»

- [x] **Зріз B1 — дані: `post_reads`.** `PostRead` у `post`-модулі (не
      `learning` — self-contained, немає FSRS-семантики) + міграція
      `Migration20260912105932`: `post_reads(id, user_id, post_id, read_at)`,
      унікальний `(user_id, post_id)`.
- [x] **Зріз B2 — бекенд: сайдбар-агрегація.** Модульне питання вирішено за
      прецедентом D10/A8 (`learning/queries/get-dictionary` вже читає
      `post`-таблиці напряму через `EntityManager`, без імпорту `PostModule`):
      сайдбар — розширення `GetPostDetailQuery`/`Handler` (`post`-модуль),
      що читає `LearningCard` напряму, без імпорту `LearningModule`.
      `GetPostDetailQuery` тепер бере опційний `userId`; гість (`null`) →
      усі пункти `new`, без БД-джойну. Дедуплікація — переюз вже унікальних
      `annotations.{words,phrases,grammar}` map. Грамат-пункт має кілька
      `usagePoints`; якщо картки є на різні usage points однієї конструкції —
      бейдж показує **найпросунутіший** стан (`domain/learning-card-state-
      priority.ts`, `New < Learning/Relearning < Review`). Слово: SRS-таргет
      — `wordId` (не `wordDefinitionId`) — уже був у `WordAnnotationView`.
      Побічний фікс: маршрут `/posts/:slugId` лишався `@Public()` (гості
      бачать пости), але тепер відповідь варіюється по сесії — переведено
      з класового `@CachePolicy('public')` на метод-рівневий `'private'`
      (інакше публічний кеш міг би віддати чужий сайдбар-стан іншому
      користувачу). Новий `@CurrentUserOrNull()` декоратор
      (`core/decorators/`) — той самий `request.raw.actor`, що і
      `@CurrentUser()`, але не кидає для гостя.
- [x] **Зріз B3 — бекенд: mark-read + "N due".** `post/commands/
      mark-post-read/` (`PostNotFoundError` 404) → `POST /content/posts/
      {slug}-{id}/read` (авторизований, ідемпотентний апсерт `post_reads`,
      незалежно від правильності відповідей — §16). `learning/queries/
      get-due-card-count/` (`COUNT(*) … due<=now()`) → `GET /learning/
      due-count` → `{ dueCount }`.
- [x] **Зріз B4 — фронтенд: рідер-сторінка.** `apps/web/src/lib/render-doc.ts`
      — span рендериться ідентично text-вузлу (жодних `class`/`data-word`/
      `data-phrase`/`data-grammar`/`tabindex`/`role` у видимій розмітці);
      весь click-to-open тултип-скрипт і `#analysis-tip`/`#analysis-data`
      видалені. Новий сайдбар «У цій статті» (`.sidebar`, три `<details open>`
      groups — Граматика/Слова/Фрази з лічильниками; `<details>` = "collapse"
      без жодного JS/sessionStorage); мердж `sidebar.{words,phrases,grammar}`
      (стан) з уже завантаженим `annotations.{words,phrases,grammar}`
      (визначення/приклад/wordId) відбувається в `.astro` фронтматері, без
      нового бекенд-поля. Слова/фрази зі станом `new` мають ту саму
      HTMX-форму `+ Add to deck` (`/partials/add-card`), що й раніше в
      тултипі; граматика веде на `/grammar/{slug}` (без add-кнопки в
      сайдбарі — вона вже є на сторінці конструкції). Comprehension-квіз і
      так уже стояв одразу під статтею, non-blocking — реальна зміна: клік
      "Check answers" тепер шле fire-and-forget `POST /partials/mark-read`
      (новий Astro partial → Nest mark-read). Рядок після квізу
      ("+N new words · M constructions learning") — похідний з розподілу
      станів у сайдбарі, рендериться лише коли є що сказати. Day streak в
      хедері — новий бекенд `learning/queries/get-streak/` → `GET /learning/
      streak`, викликається з `Layout.astro` (не з самої сторінки рідера) і
      показується на кожній сторінці для залогінених.
- [x] **Зріз B5 — фронтенд: фід — "N due" бейдж.** **Виправлення
      попереднього запису**: форсований інтерстишл із §4 таки БУВ
      реалізований — не в бекенді (`get-feed.handler.ts` справді його не
      має), а на фронтенді (`index.astro`: `ARTICLES_PER_BREAK` + `rows`
      інтерліїнг вставляв `.feed__break` картку через кожні 2 пости, поряд
      із уже наявним м'яким `.feed__note` банером). Обидва існували
      одночасно. Видалено інтерстишл-логіку (`ARTICLES_PER_BREAK`/`rows`/
      `.feed__break*`), лишився тільки м'який бейдж — тепер на
      `GET /learning/due-count` (легкий `COUNT`), а не на повному
      `/learning/practice?limit=20` (як було раніше, просто щоб порахувати
      довжину).
      **Верифікація**: `astro check` 0/0/0, `biome check apps/web` чисто,
      Playwright 30/31 (реальний Chromium проти живих `pnpm run dev` +
      `astro dev`) — 1 незалежний, задокументований і раніше (2026-09-06)
      flake в `dictionary.spec.ts` "appears in" (інтеримна
      `sentence_tokens`-залежна імплементація `/dictionary`, якої
      e2e-seed-фікстура ніколи не наповнювала — поза межами цього зрізу).
