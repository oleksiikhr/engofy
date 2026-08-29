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
  id, lemma, cefr_level, frequency_rank

word_definitions
  id, word_id, pos, definition, example

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
post_processing_jobs
  id, post_id,
  stage (fetch|spacy_parse|ai_complexity|ai_grammar|ai_exercises|publish),
  status (pending|running|done|failed),
  error_message, started_at, completed_at, retry_count
```

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
  id, telegram_message_id, raw_payload_json,
  processed (boolean), created_at
```

NestJS `@Cron` кожну хвилину викликає Telegram `getUpdates`, фільтрує повідомлення
за твоїм `telegram_user_id` (з конфігу/env, без окремої таблиці адмінів), парсить
команди (`/add {link}`, `/retry {post_id}`) і створює відповідні `posts`/`post_processing_jobs`.

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

1. **fetch** — отримати вихідний текст (посилання або текст, надісланий через бот)
2. **spacy_parse** — токенізація, POS, lemma, morphology, dependency parsing → `sentence_tokens`
3. **ai_complexity** — визначення CEFR-рівня тексту, оцінка обсягу нової лексики (Claude API)
4. **ai_grammar** — класифікація граматичних конструкцій у реченнях по закритому списку
   90 `grammar_constructions`, потім (за потреби) по `grammar_usage_points` всередині обраної
   конструкції → `grammar_matches`
5. **ai_exercises** — генерація вправ там, де детермінованого підходу недостатньо
   (переважна більшість вправ генерується без AI, напряму з `sentence_tokens`)
6. **publish** — `posts.status = published`, постановка задач у `post_publications`

Кожен стейдж — окремий retry-юніт, статус видно через `post_processing_jobs`,
керується/перезапускається командами в Telegram-боті.

---

## 6. Формат inline-розмітки (LLM-вивід перед парсингом)

Використовується замість JSON, щоб зменшити галюцинації моделі на довгих текстах.

```
[Although]{pos:conj,type:subordinator} [she]{pos:pron,role:subject}
[had never visited]{pos:verb,lemma:visit,tense:past_perfect} [Japan]{pos:propn}
before, she felt strangely [at home]{type:idiom,meaning:"почуватись комфортно"} there.
```

Символи `[` `]` `{` `}`, що вже присутні в оригінальному тексті, перед відправкою в LLM
замінюються на плейсхолдери з приватної області Unicode (`\uE001`...) і повертаються
назад після парсингу — щоб уникнути конфліктів із розміткою.

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

Розділи 1–11 вище — **цільова специфікація** (що будуємо). Нижче — як до неї
дійти від поточного стану гілки `v2`: зафіксовані рішення, аудит наявного коду
та вертикальні зрізи з чекбоксами. Режим роботи: **інкрементально в `v2`, зріз
за зрізом**, кожен зріз лишається робочим станом.

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
- **inline-markup формат** (`[форма]{pos:...,lemma:...}`) для виводу LLM
  замість JSON — менше галюцинацій на довгих текстах. Символи `[` `]` `{` `}`
  з оригіналу екрануються в плейсхолдери приватної області Unicode
  (``...) на час виклику. Реалізація вже є:
  `domain/parse-annotation-tags.ts`, `domain/annotation-prompt.ts`.
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

## 13. Аудит наявного коду (`v2`): keep / rework / build

| Область нового спеку | Що є зараз у `v2` | Вердикт |
|---|---|---|
| §3.1 `users` / `auth_sessions` / `auth_challenges`, passwordless OTP + Google | модуль `auth` — повний (CQRS, сесії, challenge, Google id-token) | **keep** як є |
| §3.1 `subscriptions` | — | build (мало) |
| §3.7 `post_processing_jobs` (6 стейджів) | `PostPipelineRun` (`postId`/`stage`/`status`, unique `(post_id, stage)`), per-stage pg-boss патерн, `worker` host, `queue` CLI | **keep патерн**, узгодити назву + розширити enum стейджів |
| §2 конвертери text/md/html → `Doc` | `converters/*` + `detect-post-source-format` — повні | **keep** |
| §6 inline-markup формат LLM | `parse-annotation-tags.ts`, `annotation-prompt.ts` — уже саме ця ідея | **keep / адаптувати** |
| §3.3 `words` / `word_definitions` / `phrases` | сутності `Word` / `WordDefinition` / `Phrase` | **keep**, +поля (`frequency_rank`, узгодити `cefr`) |
| core AI-порт | `core/ai/` (`AiClient`, `runTool<T>`, forced tool-use) | **keep**, перевикористати в кожному новому стейджі |
| §1/§5 `spacy_parse` + `nlp-service` | немає (анотація повністю через AI); чернетка `new/asd.py` | build (Python-сервіс + NestJS-порт) |
| §3.2 `sentences` / `sentence_tokens` | node-tree `PostPart` + `spliceSpans` + offset-валідація | **rework**: node-tree лишається, spaCy-шар додається паралельно (див. §12) |
| §5 `ai_complexity` | немає | build |
| §5 `ai_grammar` → `grammar_matches` | немає | build (потрібні grammar-модель + spaCy спершу) |
| наявний `content_annotation` (все-AI) | `annotate-post` handler + processor | **rework**: звести до ролі «тільки ідіоми/колокації» поверх spaCy |
| §3.4 grammar EGP модель + імпорт | немає | build (CLI-імпорт з `egpo.xlsx`) |
| §3.5 `learning_cards` / `review_logs` (FSRS) | немає | build (`ts-fsrs`) |
| §3.6 `user_skill_progress` | немає | build |
| §3.10 `exercises` | немає | build (переважно детерміновано з `sentence_tokens`) |
| §3.8 `post_publications` | немає | build лише каркас (V1 = тільки telegram) |
| §3.9 `telegram_updates` + адмін-бот | `cron/scraper` (старий news-парсинг, не про це); `cron-job-host` є | build бот; **видалити `cron/scraper`** |
| §7 Redis rate limiting + гостьовий feed | `core/redis` є; NestJS throttler | build поверх |
| §4 Astro + HTMX фронт, 8 сторінок | немає (тільки API: `auth` контролер, `health`) | build (окремий workspace-пакет) |
| §8 мок-монетизація | немає | build (мало) |

---

## 14. Вертикальні зрізи

Порядок: дані → парсинг → AI → навчання → UI. Кожен зріз тестується через
CLI/API ще до появи фронтенду.

### Зріз 0 — підготовка

- [x] Розділ 12–15 у `PLAN.md` (цей крок).
- [x] Видалити `src/entrypoints/cron/scraper/` (cron-host лишається для
      Telegram getUpdates; `CronModule` тепер порожній mount-point).
- [x] `content` → `post` вже зроблено: CLI `engofy post ingest`, модуль `post`,
      `PostPart`/`PostPipelineRun`, колонки `post_id`. Залишки `content_*` є
      лише в історичних міграціях (`Migration20260824192359`, перейменування в
      `Migration20260826081301`) — незмінні, лишаємо. Слово «content» у
      `annotation-prompt.ts` = лінгвістичний термін «content word», не стара
      сутність.
- [x] `draft/` (eval-харнес анотаційного промпту) — лишити, знадобиться для
      зрізу 3 (eval `ai_grammar`).

### Зріз 1 — дані-фундамент (без поведінки)

- Міграції під усі нові таблиці розділу 3 (порожні, без логіки), по одній на
  логічну групу:
  - [x] `subscriptions` — `Subscription` entity в `modules/auth/entities/`,
        enum'и `SubscriptionPlan`/`SubscriptionStatus`, `Migration20260829123821`.
  - [x] spaCy-шар: `Sentence` (`post_part_id` + `unit_index` + offset,
        денормалізований `post_id`, `cefr_level` nullable) та `SentenceToken`
        (raw spaCy `pos`/`tag`/`dep` як text — не enum `PartOfSpeech`;
        `head_position`, `morph` jsonb, `is_gerund`/`is_idiom_part`,
        `phrasal_verb_group_id`/`word_id`/`phrase_id` nullable FK).
        `Migration20260829124255`.
  - [x] grammar (`modules/post/entities/`): `GrammarCategory`,
        `GrammarConstruction`, `GrammarUsagePoint` (`cefr_level` = `CefrLevel`),
        `GrammarMatch` (`token_start`/`token_end` = `SentenceToken.position`,
        `confidence` real nullable). `Migration20260829124701`.
  - [x] FSRS (нове `modules/learning/`): `LearningCard` (CHECK
        `learning_cards_exactly_one_target` — рівно один з
        `word_id`/`phrase_id`/`grammar_usage_point_id`; поля ts-fsrs Card),
        `ReviewLog` (append-only, slim). Enum'и `LearningCardState`/
        `ReviewRating` (text, мапляться на числові ts-fsrs у Зрізі 6).
  - [x] `UserSkillProgress` (`modules/learning/`, unique
        `(user_id, construction_id)`), `Exercise` + enum'и
        `ExerciseType`/`ExerciseSource` (`modules/post/`), `PostPublication` +
        enum'и `PublicationPlatform`/`PublicationStatus` (unique
        `(post_id, platform)`), `TelegramUpdate` (нове `modules/telegram/`,
        `telegram_message_id` bigint unique).
  - [x] `PostPipelineStage` enum переписано на 7 стейджів (`fetch`/`spacy_parse`/
        `annotation`/`ai_complexity`/`ai_grammar`/`ai_exercises`/`publish`;
        старі `grammar_tagging`/`comprehension_questions`/`conversation_kit`
        прибрано — використовувався тільки `annotation`). `PostPipelineRun` +
        `started_at`/`error_message`/`retry_count`.
  - [x] `Word.frequencyRank` (int nullable). **Відкрито:** спека §3.3 кладе
        `cefr_level` на `words`, код тримає його на `WordDefinition` (per-POS) —
        не чіпав, бо це зачіпає annotation-пайплайн; розв'язати у Зрізі 3.
- [x] `assets/irregular-verbs.json` (164 дієслів, `past_simple`/`past_participle`
      як масиви, `cefr_level`) + доменний парсер/валідатор
      `modules/post/domain/irregular-verb.ts` (zod, ловить дублі base_form) +
      CLI `engofy grammar import-irregular-verbs`
      (`entrypoints/cli/grammar/`, новий `GrammarCliModule`) — ідемпотентно
      створює `Word` рядки для base_form (case-insensitive dedupe по
      `words.lemma`). Інфлектовані форми лишаються в JSON, не в БД.
- [x] `assets/egp.json` (1239 записів, витягнуто з `ninja33/EGP` `egpo.xlsx` →
      JSON один раз, з чисткою mojibake-апострофів; `index` = стабільний
      idempotency-ключ) + `assets/README.md` (провенанс) + доменні хелпери
      `modules/post/domain/egp.ts` (zod, `classifyEgpRecord` use/form,
      `grammarConstructionSlug` = `category-subcategory` бо subcategory не
      унікальна, `buildCheatSheet`) + CLI `engofy grammar import-egp`.
      Прогнано: **19 категорій / 90 конструкцій / 574 usage points** (665
      FORM/comment → cheat sheet), ідемпотентно (category by name,
      construction by slug, usage point by `egpIndex`). `GrammarUsagePoint`
      +`egp_index` (unique nullable), `Migration20260829132257`. xlsx-парсер у
      залежності **не** додавав — дані заморожені.
- [x] `assets/word-frequency.txt` (top 50 000 англ. слів, один на рядок,
      згенеровано раз через `wordfreq` `top_n_list('en',…)` за допомогою `uv`,
      відфільтровано до буквених токенів) + чистий хелпер
      `modules/post/domain/word-frequency.ts` (`parseWordFrequencyList` →
      `Map<word, 1-based rank>`) + CLI `engofy words import-frequency`
      (новий `WordsCliModule`) — проставляє `words.frequency_rank` на наявних
      `Word` (case-insensitive по lemma), ідемпотентно. Прогнано: 433/445
      слів отримали ранг. npm/py-залежність wordfreq **не** додавав.

### Зріз 2 — nlp-service + стейдж `spacy_parse`

- [x] `nlp-service/` (FastAPI + `en_core_web_sm`, `app.py` + pinned
      `requirements.txt` + `README.md`): `POST /parse` приймає один
      флеттен-юніт → `{ sentences: [{ text, start, end, tokens: [{ index,
      text, lemma, pos, tag, dep, morph, head, start, end }] }] }`. Sentence
      offset — у сабміченому тексті, token offset — у тексті свого речення,
      `head` — sentence-local індекс (== index для кореня). Герундій/розрив
      фразових **не** тут — сирі поля spaCy, детермінізм у NestJS-домені.
      `new/` прибрано з кореня.
- [x] NestJS `NlpClient` порт (`core/nlp/`) за зразком `core/ai/`:
      `nlp-client.port.ts` (`NLP_CLIENT`, типи `NlpToken`/`NlpSentence`/
      `NlpParseResult`), `nlp.config.ts` (`NLP_SERVICE_URL`, timeout),
      `nlp-client.provider.ts`, `http-nlp-client.service.ts` (global `fetch`
      + `AbortSignal.timeout`, кидає на не-2xx / транспортну помилку).
      Зареєстровано в `PostModule`.
- [x] Стейдж `spacy_parse` (`commands/spacy-parse-post/`, pg-boss
      `post-spacy-parse`): по `PostPart` → `flattenPostPartUnits` → на юніт
      `NlpClient.parse` → `sentences` + `sentence_tokens` (offset у
      plain-тексті юніта; token offset у `Sentence.rawText`). Ідемпотентно
      через `PostPipelineRun` (стейдж-рівень) + пропуск парта, що вже має
      `Sentence` рядки; flush по одній `PostPart` (§12). Валідація
      offset-ів `text[start:end] === form` до запису → `NlpOffsetMismatchError`
      завалює всю джобу (§12 all-or-nothing). `ingest-post` тепер ставить і
      `post-annotation`, і `post-spacy-parse` (паралельні шари, §12).
      Воркер: `SpacyParsePostProcessor` + `SpacyParsePostModule`.
- [x] Детерміновано в `domain/build-sentences.ts` (юніт-тести):
      `computePhrasalVerbKeys` — частка (`dep=prt`/`tag=RP`) → голова-дієслово
      через залежність, ключ `lemma + particle` (напр. `pick up`), спільний
      для дієслова й усіх фрагментів; хендлер резолвить у `Phrase`
      (`phrasal_verb`) через `upsert-phrase-id.ts` →
      `sentence_tokens.phrasal_verb_group_id`. `detectGerund` — `-ing` у
      номінальній dep-ролі; `VBG` завжди, `NN` лише без власного `det`
      (`en_core_web_sm` тегає голий герундій-підмет то `VBG`, то `NN`).

### Зріз 3 — AI-стейджі поверх spaCy

- [x] **Structured-output у `core/ai`**: `AiClient.completeStructured<T>({
      system, userText, tool: { name, description, schema: ZodType<T> } })` —
      forced single-tool call, `input_schema` з `z.toJSONSchema`, відповідь
      валідовано `tool.schema.parse`. Fake-и в ispec'ах оновлено.
- [x] `ai_complexity` (`commands/assess-complexity/`, pg-boss
      `post-ai-complexity`): один виклик оцінює весь пост + кожне речення по
      CEFR. Читає `sentences` (тому стоїть після `spacy_parse`; хендлер
      `spacy_parse` тепер ставить `ai_complexity` при завершенні —
      pipeline-ланцюг §5). `posts.cefr_level` (нова колонка,
      `Migration20260829141156`) + `sentences.cefr_level`. `newVocabRatio`
      лишається у лозі (окремої колонки в §3 нема). Домен
      `complexity-prompt.ts`: prompt + zod-схема + `buildComplexityUserText`
      + `indexComplexityLevels` (кидає при пропуску/дублі/out-of-range —
      §12 all-or-nothing). Ідемпотентно через `PostPipelineRun`. Воркер:
      `AssessComplexityProcessor`/`Module`. Live-smoke проти Anthropic
      пройдено.
- [x] `ai_grammar` → `grammar_matches` (`commands/tag-grammar/`, pg-boss
      `post-ai-grammar`; `ai_complexity` ставить його при завершенні). Формат —
      **inline-markup** (рішення користувача), як анотація:
      `GRAMMAR_SYSTEM_PROMPT` + каталог із БД (`buildGrammarCatalog`: 90
      конструкцій, кожна зі своїми usage points як `[egpIndex] CEFR
      guideword — canDo`); модель повертає пронумеровані рядки речень із
      `⟦span⟧{{g|slug|egpIndex}}`. `parse-grammar-tags.ts` (regex + recon-
      struct-and-compare, як `parse-annotation-tags`) + `parseGrammarResponse`
      (рядки → per-sentence spans, `isComplete`, 1 ретрай). `grammar-span-
      tokens.ts` `spanToTokenRange` — char-span → half-open діапазон
      `SentenceToken.position`. Хендлер валідує slug ∈ каталог та egpIndex ∈
      цій конструкції (інакше дроп + warn), резолвить у `GrammarUsagePoint`,
      пише `GrammarMatch(sentenceId, grammarUsagePointId, tokenStart,
      tokenEnd)`. Ідемпотентно: `PostPipelineRun` + `nativeDelete` матчів
      речень при партіал-ретраї. Воркер `TagGrammarProcessor`/`Module`.
      Live-smoke проти Anthropic пройдено (past-perfect / 1st conditional /
      could-request розпізнані, валідні egpIndex).
- [ ] Eval `ai_grammar` через `draft/`-харнес перед мержем. Харнес
      **побудовано й провалідовано** (`draft/lib/{call-nlp,grammar-catalog,
      parse-content-sentences,grammar-tag-file}.ts` +
      `draft/scripts/{run,snapshot,compare}-grammar.ts`, README-секція
      "Grammar harness"): реюз реальних `parseGrammarResponse` /
      `parseGrammarTags` / `spanToTokenRange` + та сама drop-драбина, що в
      `TagGrammarHandler.persistMatch`; каталог відновлюється з
      `assets/egp.json` тими ж хелперами, що `import-egp` (78 конструкцій /
      574 usage points — 78, бо handler фільтрує 12 cheat-sheet-only; це
      рівно те, що йде в prompt); `parse-content-sentences` дзеркалить
      ingest+`spacy_parse` через живий `nlp-service`. Smoke на `article.md`
      (16/16 spans persisted, 8 конструкцій, `isComplete:false` після
      ретраю) і `plain.txt` (3/6 persisted, 3 dropped unknown-slug).
      **Лишається**: прогнати повний baseline по всіх `examples/content/*`
      (`snapshot-grammar.ts`, ~$3-4, ~25хв), закомітити його в
      `draft/baselines/`, переглянути метрики (unknown-slug drops,
      `isComplete`) — і за потреби підкрутити `grammar-prompt.ts`.
- [ ] Rework `content_annotation`: spaCy дає POS/lemma/morph; AI лишає тільки
      ідіоми/колокації, яких spaCy не бачить. Лінк `sentence_tokens.word_id` /
      `phrase_id`. `words.cefr_level` **лишається per-POS на `WordDefinition`**
      (рішення користувача — спека §3.3 неформальна).
      **Прода ще нема** (немає прод-БД / користувачів / живого пайплайну — лише
      локальний dev-стек), тому цей rework можна робити звичайним зрізом без
      обережності — «торкає робочий пайплайн» означає лише «тримати dev ingest
      + unit/integration тести зеленими». Раніше було відкладено як «окремий
      обережний крок» — це знято.

### Зріз 4 — вправи + публікація статусу

- [x] Детермінована генерація `exercises` з `sentence_tokens`
      (`domain/build-exercises.ts`, чисті ф-ції + `build-exercises.spec.ts`):
      **fill_blank** (перше content-слово NOUN/VERB/ADJ/ADV, не крайнє,
      alpha ≥3), **reorder** (5–14 токенів, детермінований mulberry32-shuffle
      seed=sentenceId, скіп якщо збігся з оригіналом), **multiple_choice**
      (fill_blank + 3 дистрактори з пулу `pos|tag` поста, скіп якщо <3),
      **find_error** (регулярне VBD → base form, не be/have/do, не lemma===text;
      капіталізація коли на початку речення). Кожен тип capped
      `maxPerType=8`, вивід стабільно згрупований FB→RO→MC→FE.
- [x] `ai_exercises` стейдж (`commands/generate-exercises/`, pg-boss
      `post-ai-exercises`, воркер `GenerateExercisesProcessor`/`Module`;
      `tag-grammar` ставить його при завершенні — ланцюг тепер
      spacy_parse→ai_complexity→ai_grammar→ai_exercises→publish). Хендлер:
      детерміновані `buildExercises` + **один** `completeStructured` виклик
      для comprehension (`domain/comprehension-prompt.ts`: prompt + zod
      `comprehensionToolSchema` 2–5 питань × рівно 4 опції + answerIndex 0..3
      + `comprehension-prompt.spec.ts`). `nativeDelete(Exercise,{postId})` +
      персист (`source=spacy` для детермінованих, `source=ai` +
      `type=comprehension` для AI). Ідемпотентно через `PostPipelineRun`.
      Live-smoke comprehension проти Anthropic пройдено (5 валідних питань).
- [x] Стейдж `publish` (`commands/publish-post/`, pg-boss `post-publish`,
      воркер; кінець ланцюга — нічого не ставить далі). `posts.status =
      published` (нове значення enum + `Migration20260829153800` оновлює
      `posts_status_check`), `posts.published_at = now()`, `em.upsert`
      `PostPublication(platform=telegram, status=pending)` на unique
      `(post_id, platform)` з `onConflictAction:'ignore'` (реальна відправка —
      Зріз 5). Ідемпотентно через `PostPipelineRun`.
- Перевірки зелені: `pnpm run type`, `biome check src/`, 397 unit
      (+build-exercises 15, +comprehension-prompt 4), 89 integration
      (+generate-exercises 3, +publish-post 2). Не закомічено на `v2`.

### Зріз 5 — Telegram адмін-бот

Новий `modules/telegram/` (config + `services/` + `domain/`), крони в
`entrypoints/cron/telegram/`, `CronModule` імпортує `TelegramCronModule`.
`TELEGRAM_BOT_TOKEN`/`TELEGRAM_ADMIN_USER_ID`/`TELEGRAM_CHANNEL_ID` у
`.env.development` (порожні → обидва крони no-op).

- [x] `@Cron` (1 хв) `PollUpdatesCron` → `PollUpdatesService`: Telegram
      `getUpdates` (raw `fetch`, `allowed_updates:['message']`), offset =
      `max(telegram_message_id)+1` з таблиці (raw SQL з
      `getTransactionContext()`, без окремого курсора). Кожен новий апдейт →
      рядок `telegram_updates` (unique на `update_id` = ідемпотентність,
      re-poll = no-op), flush по одному. Фільтр `message.from.id ===
      TELEGRAM_ADMIN_USER_ID` — не-адмін лише зберігається + `processed=true`.
- [x] Парсинг команд (`domain/parse-command.ts`, pure + spec, толерує
      `@botname`): **`/add <text>`** (рішення користувача — вставлений текст,
      не URL; без fetch-стейджу/деп) → `PostService.ingest({rawText})` →
      відповідь з `shortId`. **`/retry <post_id>`** → новий
      `commands/retry-post/` (`nativeDelete` `PostPipelineRun` поста +
      `status=Pending` + re-enqueue `post-annotation`+`post-spacy-parse` як
      ingest). Помилка команди → reply з текстом, апдейт усе одно
      `processed=true`.
- [x] `post_publications` telegram-адаптер: **cron-polled** (рішення
      користувача) — `PublishPendingCron` (1 хв) → `PublishPendingService`
      бере `pending` рядки `platform=telegram` (batch 10), шле анонс у
      `TELEGRAM_CHANNEL_ID` (`domain/format-announcement.ts`: title + CEFR +
      `PUBLIC_URL/posts/{slug}-{shortId}`), → `published`+`externalId`
      (message_id) або `failed`+`errorMessage`, flush по одному.
- Перевірки зелені: type, biome, 409 unit (+parse-command 7,
      +format-announcement 5), 99 integration (+poll-updates 5,
      +publish-pending 3, +retry-post 2). Без міграцій. Не закомічено.
      Live-smoke неможливий локально (немає бот-токена) — покрито
      fake-клієнтом в ispec'ах.

### Зріз 6 — SRS (FSRS) + монетизація

Новий `modules/learning/` (facade → command/query → services/domain) +
`modules/billing/` (subscription-поведінка; сутність `Subscription` лишається
в `auth/entities/`). Web: `LearningWebModule` (`/learning/*`),
`BillingWebModule` (`/billing/*`), обидва під глобальним `SessionAuthGuard`.

- [x] `learning_cards` / `review_logs` + `ts-fsrs@5.4`. `FsrsService` —
      `fsrs(generatorParameters({ enable_short_term: false }))` (для vocab
      sub-day steps = шум; тримає картку 1:1 з таблицею, без колонки
      `learning_steps`). `domain/fsrs-mapping.ts` (pure + spec) — Luxon↔Date,
      text-enum↔numeric `State`/`Rating`. `Migration20260829160035` — 3
      composite `@Unique` `(user_id, {word|phrase|grammar_usage_point}_id)`
      (Postgres NULLs distinct → одна картка на таргет).
- [x] API: `POST /learning/cards` (рівно один з
      `wordId`/`phraseId`/`grammarUsagePointId`, `.refine` у zod DTO;
      ідемпотентно — повторний додаток повертає наявну картку; 400 на
      неіснуючий таргет), `GET /learning/practice?limit=20` (картки з
      `due<=now`, `due asc`, з денормалізованим `target.primary/secondary`),
      `POST /learning/cards/:id/review` `{rating}` → перепланування +
      append `review_logs`. **Skill-progress (`user_skill_progress`) — Зріз 7.**
- [x] Ліміт `FREE_CARD_LIMIT=100` — `CardLimitService.assertCanAddCard`:
      `COUNT(*) learning_cards WHERE user_id` (без розбивки за типом, §12),
      пропускає premium. `CardLimitReachedError extends DomainError` → 400.
- [x] `subscriptions` мок-флоу: `POST /billing/subscribe` →
      `ActivateMockSubscriptionCommand` (premium, `isMockPayment=true`,
      `currentPeriodEnd = max(now, existing) + 1 month` — не дублює рядки),
      `GET /billing/subscription`. `SubscriptionService.isPremium` = активний
      premium-рядок з `currentPeriodEnd > now` (знімає ліміт карток).
- Перевірки зелені: type, biome, 423 unit (+card-target 6, +fsrs-mapping 5,
      +fsrs.service 3), 117 integration (+add-card 5, +review-card 3,
      +practice-queue 2, +activate-mock-subscription 2, +learning e2e 4,
      +billing e2e 2). Дод. деп `ts-fsrs`. Не закомічено.

### Зріз 7 — skills / прогрес

- [x] `user_skill_progress` write-path у `modules/learning/services/
      skill-progress.service.ts` (callers флашать):
      `unlockConstruction(userId, grammarUsagePointId)` — `AddCardHandler`
      кличе для grammar-таргета після персисту нової картки: upsert
      `UserSkillProgress(userId, constructionId)` + `unlockedAt` якщо null.
      `recordGrammarReview(userId, card, rating)` — `ReviewCardHandler` кличе
      після перепланування (no-op для word/phrase карток): `totalAttempts++`,
      `correctAttempts++`/`correctStreak++` коли rating ≠ Again (інакше
      `correctStreak = 0`), і **recompute `masteryScore`** по всій
      конструкції.
- [x] `mastery_score` (рішення користувача — **від FSRS-стану картки**, не
      від correct/total): `domain/mastery.ts` (pure, spec) —
      `cardMasteryContribution` = 0 для `New`, інакше
      `clamp(100·(1−e^(−stability/30)), 0, 100)`; `aggregateMasteryScore` =
      `round(mean)` по всіх `learning_cards` користувача, чий
      `grammar_usage_point_id` ∈ usage points конструкції. `correct_streak`/
      `*_attempts` лишаються, але лише для показу.
- [x] Streak (рішення користувача — **derive з `review_logs`, без лічильника**):
      `domain/daily-streak.ts` (pure, spec) `computeDailyStreak(reviewedAt[],
      now)` — послідовні UTC-дні з ≥1 review, що закінчуються сьогодні (або
      вчора, якщо сьогодні ще порожньо).
- [x] `GET /profile` (рішення користувача — **один агрегат**, під глобальним
      `SessionAuthGuard`): новий `entrypoints/web/profile/` (`ProfileWebModule`
      у `web.module.ts`), `queries/get-profile/` handler у `modules/learning/`.
      Віддає `{ streak, cefr: { A1..C2: n }, categories: [{ name,
      constructions: [{ slug, name, cefrLevel, locked, masteryScore,
      correctStreak }] }] }`. `categories` = 19 EGP-категорій за `sortOrder`,
      кожна зі своїми конструкціями за `sortOrder`; `cefrLevel` конструкції =
      найлегший рівень її usage points (`domain/cefr-order.ts`). `locked` =
      немає `unlockedAt`. `cefr` = кількість SRS-карток користувача за рівнем
      таргета (grammar → usage point `cefrLevel`; word → найлегший
      класифікований `WordDefinition.cefrLevel`; phrase → `Phrase.cefrLevel`;
      некласифіковані не рахуються).
- Без міграцій (`user_skill_progress` вже є з Зрізу 1;
      `migration:check` чистий). Перевірки зелені: type, biome, 441 unit
      (+mastery 6, +daily-streak 8, +cefr-order 4), 125 integration (+add-card
      1, +review-card 3, +get-profile 2, +profile e2e 2). Не закомічено.

### Зріз 8 — фронтенд (Astro + HTMX)

Рішення (користувач, 2026-08-29): фронт — окремий workspace-пакет `apps/web/`
(`@engofy/web`), Astro + Tailwind CSS, HTMX через npm. Nest і Astro за одним
доменом через reverse-proxy, який `/api/*` направляє в Nest **зі зрізанням
префікса** (nginx `location /api/ { proxy_pass .../; }`, у dev — Vite
`server.proxy` з `rewrite`) — тому в Nest **немає** глобального префікса, нові
read-роути суто адитивні. Astro SSR-сторінки звуть Nest по внутрішньому URL,
прокидаючи вхідний `Cookie`; inline-розбір рендериться на сервері Astro з
node-tree, tooltip/«+» — HTMX-партіали (§6). Зріз ділиться на 8a (read-API) +
8b (сторінки).

#### Зріз 8a — нові read-endpoint'и Nest (DONE, 2026-08-29, uncommitted на `v2`)

- [x] `modules/post/queries/`: `get-feed` (published, newest-first,
      offset-пагінація, plain-text excerpt із перших блоків через
      `flattenPostPartUnits`), `get-post-detail` (по `shortId`; `assembleDocFromParts`
      → `Doc` + resolved `annotations.{words,phrases,grammar}` зі spans каталогу
      node-tree через новий `domain/collect-spans.ts` + `exercises` як є;
      published-only; **inline-розбір зі spans node-tree, не зі spaCy
      `sentences`/`grammar_matches`** — §12), `get-grammar-reference` (19 кат →
      конструкції, опц. `?cefr=` фільтр), `get-grammar-construction` (одна
      конструкція + cheat sheet + usage points; null → 404).
- [x] `modules/learning/queries/get-dictionary` — word+phrase SRS-картки
      користувача (grammar виключено), статус + «у яких постах». «У яких постах»
      **інтерим**: скан spans node-tree опублікованих постів (немає
      `post_word`/`post_phrase` — §3.3 його не збудували в Зрізі 1;
      `sentence_tokens.word_id` порожній до rework annotation). Проєкційна
      таблиця — правильний фікс пізніше.
- [x] Фасади: `PostService` +`QueryBus` +`getFeed`/`getPostDetail`/
      `getGrammarReference`/`getGrammarConstruction`; `LearningService`
      +`getDictionary`. `cefr-order.ts`+spec переїхали
      `learning/domain/` → `post/domain/` (post володіє `CefrLevel`).
- [x] Web-entrypoints: `entrypoints/web/content/` (`ContentController`, усе
      `@Public()`: `GET /feed`, `/posts/:slugId`, `/grammar`, `/grammar/:slug`;
      `parse-slug-id.ts` бере хвостовий сегмент `{slug}-{shortId}`),
      `entrypoints/web/dictionary/` (`DictionaryController` `GET /dictionary`,
      під глобальним `SessionAuthGuard`). Обидва в `web.module.ts`
      DEFAULT_SUB_MODULES. Response-DTO дзеркалять view (дати — ISO-string).
- Перевірки зелені: type, `biome check src/`, 446 unit (+parse-slug-id 5),
      135 integration (+content e2e 7, +dictionary e2e 3). `migration:check`
      чистий. Без міграцій. Не закомічено.

#### Зріз 8b — сторінки `apps/web/` (Astro + Tailwind + HTMX), у порядку:

- [x] **Каркас пакета (2026-08-29, uncommitted).** Воркспейс `packages: [apps/*]`
      у `pnpm-workspace.yaml` (без `.` — root і так workspace-root) +
      `minimumReleaseAgeExclude` для Astro/Shiki/`@img`/vscode-* toolchain
      (7-денний gate б'ється зі свіжим Astro-стеком; Nest runtime-деп лишається
      під gate). `apps/web/`: **Astro 7.2.9** + `@astrojs/node@11` standalone
      SSR (`output:'server'`, image service = `noop` → без sharp),
      `@tailwindcss/vite`+`tailwindcss@4.3.3` (Tailwind v4 `@theme`),
      `htmx.org@2.0.10` (bundled у Layout). `astro.config.mjs`: Vite
      `server.proxy` `/api` → `API_ORIGIN` (деф. `http://localhost:8080` = dev
      `PORT`) з `rewrite` (зрізає префікс) — лише dev; прод-проксі (nginx) —
      Зріз 9/деплой. `src/lib/api.ts` (`apiGet`/`apiGetOrNull`, forward
      `Cookie`, `ApiError`), `src/lib/session.ts` (`getCurrentUser` → 401=гість),
      `src/lib/types.ts` (дзеркало 8a DTO), `src/lib/post-url.ts`.
      `Layout.astro` + `SiteHeader.astro` + `src/styles/app.css` — токени
      портовані з `../engofy-go/frontend/src/styles/app.css` (indigo/amber,
      Manrope 700 + Public Sans 400/600 + IBM Plex Mono 600 woff2 у
      `src/styles/fonts/`) + атоми `.card/.badge/.btn` + inline-analysis
      (`.word/.phrase/.grammar/.add-card`) + FSRS-grade кнопки.
      `src/pages/index.astro` — тимчасовий feed-список (повний варіант — нижче).
      Свій `apps/web/Dockerfile` (context = repo root, `pnpm --filter
      @engofy/web`, runtime = `node ./dist/server/entry.mjs`). `apps/web/biome.json`
      (лінтить лише `.ts/.mjs/.json` — biome Astro-парсер сирий; root `biome.json`
      +`!apps/**`; root `tsconfig.json` +`exclude:[apps]`).
      `playwright.config.ts` (без `webServer` — потрібен піднятий стек; патерн зі
      старого сайту) + `e2e/smoke.spec.ts` (2 тести).
      Перевірки: `astro check` 0 помилок, `biome check` (apps/web + root src/),
      root `pnpm run type`, повний стек піднято руками (Nest :8080 + `astro dev`
      :4321) — Playwright 2/2 зелені (shell + `/feed` через proxy + токен
      шрифту). Не закомічено.
- [x] **Спільна e2e-інфра (2026-08-29, uncommitted).** `test/e2e/seed-web-e2e.ts`
      — standalone `MikroORM.init` з `mikro-orm.setup.ts` + явним списком
      entity-класів (без Nest/Redis), сіє детерміновані фікстури в *dev*-БД
      (НЕ test, schema не чіпає), ідемпотентно (wipe за тегами
      `E2E`/`e2e-`/фікс-юзер → insert). `apps/web/e2e/global-setup.ts`
      (`globalSetup` у `playwright.config.ts`) шелить seed через
      `node --import @swc-node/register/esm-register` + пише
      `e2e/.auth/state.json` storageState з фікс-cookie `__Host-session`
      засіяної сесії (Chromium шле Secure-cookie на http://localhost — ОК).
      `e2e/auth.ts` `AUTHED_STATE`; authed-спеки роблять
      `test.use({ storageState: AUTHED_STATE })`. Фікс-юзер `e2e@engofy.test`,
      пост `E2Eread1` (+`E2Efeed2..4`), граматика `e2e-past-perfect`/
      `e2e-present-simple`, картки word/phrase/grammar (частина due), skill
      progress + review_logs (streak=3), без підписки.
- [x] `/posts/{slug}-{id}` — текст з інлайн-розбором, tooltip, «+», вправи
      (2026-08-29, uncommitted). `src/lib/render-doc.ts` — node-tree Doc →
      HTML-рядок (escape, `set:html`); spans несуть `class` word/phrase/grammar
      + `data-word`/`data-phrase`/`data-grammar` + `tabindex`/`role=button`.
      `src/pages/posts/[slugId].astro`: SSR `apiGetOrNull('/posts/:slugId')`
      (404 → `Response 404`), CEFR-badge/дата/source-link, `.analysis` тіло,
      `<script type=application/json id=analysis-data>` з `annotations`.
      Tooltip — `is:inline` client-JS з вбудованих даних (без HTMX-fetch на
      span); всередині форма `hx-post="/partials/add-card"`
      `hx-swap="outerHTML"` (word→wordId, phrase→phraseId, grammar→кожен
      usagePoint). `src/pages/partials/add-card.ts` (Astro `POST`-endpoint) →
      Nest `POST /learning/cards` з forward-cookie → HTML-фрагмент
      (`✓ Saved` / `Sign in` для 401 / `go Premium` для 400). Вправи
      (fill_blank/multiple_choice/find_error/reorder + comprehension) —
      view-моделі в frontmatter (Astro JSX не тримає `as`-каст), інтерактивна
      перевірка на клієнті з `data-answer`/`data-answer-index`/`data-order`.
      `Layout.astro` фікс: `import htmx from 'htmx.org'; window.htmx = htmx`
      (ESM-білд не自-присвоює), `Window.htmx` тип у `env.d.ts`. Токени tooltip/
      add-card перенесені в глобальний `app.css` (Astro scoped не досягає
      innerHTML). `src/lib/api.ts` +`apiPost`/`isBadRequest`; `types.ts`
      `SpanNode` → discriminated union, `Subscription.status`→`active`.
      e2e `apps/web/e2e/reader.spec.ts` (6 тестів: рендер+spans, tooltip+гість
      «+»→Sign in, fill_blank grade, comprehension grade, 404, authed «+»→
      Saved). Перевірки зелені: `astro check` 0, `biome check` apps/web+root,
      root `pnpm run type`, Playwright reader+smoke 8/8.
- [x] `/` — стрічка з чергуванням стаття → повторення (2026-08-29, uncommitted).
      `index.astro`: `/feed?limit=12&offset=`, `?offset=` пагінація
      (Newer/Older). Для авторизованих — `apiGetOrNull('/learning/practice
      ?limit=20')`, вставляє review-break картку (`data-testid=review-break`:
      `target.primary`+`secondary`, кнопка «Review now» → `/practice`) після
      кожних 2 постів (`ARTICLES_PER_BREAK`, не після останнього). Гість —
      просто список. e2e `feed.spec.ts` (2: guest список+лінк без break; authed
      1 break з due-терміном).
- [x] `/practice` — SRS-черга (2026-08-29, uncommitted). `src/lib/practice-card.ts`
      `renderPracticeQueue(cards)` — спільний рендер для SSR і партіалу
      (картка `data-testid=practice-card`: count, type-kicker, front
      `target.primary`, «Show answer» для `secondary`, форма з 4 grade-кнопками
      `name=rating value=again|hard|good|easy` → app.css кольори) або
      «All caught up» (`data-testid=practice-done`). `practice.astro` — гість→
      Sign in, інакше `#practice-container` з `set:html`; delegated «Show
      answer» toggle. `src/pages/partials/review.ts` (Astro `POST`) → Nest
      `POST /learning/cards/:id/review {rating}` → перечитує `/learning/practice`
      → `renderPracticeQueue(next)` у `hx-target=#practice-container`. e2e
      `practice.spec.ts` (2: guest→Sign in; authed — front `perambulate`, grade
      Good → front `at loose ends`; НЕ дренить чергу).
- [x] `/grammar` — довідник + фільтр CEFR (2026-08-29, uncommitted).
      `grammar.astro`: `/grammar` або `/grammar?cefr=X`, категорії з ≥1
      конструкцією; чипи All/A1..C2 = `<a href=?cefr=>` + HTMX
      (`hx-get`/`hx-target=#grammar-panel`/`hx-select=#grammar-panel`/
      `hx-swap=outerHTML`/`hx-push-url`) — активний чип у свопнутому регіоні.
      `grammar/[slug].astro`: `apiGetOrNull('/grammar/:slug')` (404→`Response`),
      cheat sheet через `src/lib/markdown.ts` (міні-MD: h*, `- ` list, `**`,
      `` ` ``, все escape), usage points з формою «+ Add to deck»
      (`grammarUsagePointId`). e2e `grammar.spec.ts` (7: список, фільтр SSR,
      фільтр HTMX-чип, 404, detail cheat+2 usage points, guest «+»→Sign in,
      authed «+»→Saved).
- [x] `/dictionary` — особистий словник (2026-08-29, uncommitted).
      `dictionary.astro`: гість→Sign in, інакше `GET /dictionary` → картки
      (`data-state`/`data-text` для клієнт-фільтру), badge type+CEFR, стан,
      definition/example, «Appears in:» лінки на пости. Клієнт-JS: пошук
      (`#dict-search`) + фільтр статусу (`#dict-state`) через `el.hidden`,
      лічильник. e2e `dictionary.spec.ts` (3: guest→Sign in; authed список+
      контекст; пошук «loose» + фільтр «review» звужують).
- [x] `/profile` — skills-дерево, streak, CEFR (2026-08-29, uncommitted).
      `profile.astro`: `GET /profile` → 2 stat-картки (streak, unlocked/total),
      CEFR-бари A1..C2 (`data-testid=cefr-A1..`), 19 категорій як `<details>`
      (open якщо є unlocked), конструкції з badge+`skill--locked`/mastery-бар,
      лінк `/grammar/:slug`. Гість→Sign in. e2e `profile.spec.ts` (2: guest→
      Sign in; authed streak=3, cefr B1/B2 =1, past-perfect не locked +
      mastery-бар).
- [x] `/login` + `/logout` (2026-08-29, uncommitted). `login.astro`: вже
      залогінений → redirect `/`. Крок email (`action=request-code` →
      `POST /auth/login`) → крок code (`action=verify-code` →
      `apiPostRaw('/auth/login/verify-code')`, форвардить Set-Cookie через
      `res.headers.getSetCookie()` на 303-редірект `/`). Deep-link
      `?step=code&email=`. Google-кнопка (GIS) лише якщо
      `PUBLIC_GOOGLE_CLIENT_ID` (`action=google` → `/auth/google`). Помилки
      inline (`role=alert`). `src/pages/logout.ts` (`POST`): `/auth/logout` +
      **власний** clearing Set-Cookie з `Secure` (Nest `clearCookie` губить
      Secure → `__Host-` cookie не чиститься браузером). `src/lib/api.ts`
      +`apiPostRaw`; `apiPost`/`apiPostRaw` не шлють `content-type: json` без
      тіла (Fastify давився порожнім JSON на `/billing/subscribe`). Seed +
      `AuthChallenge` фікстура (`login-e2e@engofy.test` / OTP `424242`).
      e2e `login.spec.ts` (3: email→code крок; невірний код→alert; OTP-вхід
      + вихід через хедер).
- [x] `/pricing` — мок-оплата (2026-08-29, uncommitted). `pricing.astro`:
      `GET /billing/subscription`; гість→«Sign in to upgrade»; free→кнопка
      «Upgrade to Premium» (форма `action=subscribe` → `POST /billing/subscribe`
      → `justUpgraded` банер + `data-testid=premium-active`); premium→«Active —
      renews …». Free/Premium порівняння, ліміт 100. e2e `pricing.spec.ts`
      (2: guest→Sign in; authed upgrade→premium, тримається після reload).
- Перевірки зелені (весь 8b): `astro check` 0/0/0, `biome check` apps/web +
      root `src/`+`test/`, root `pnpm run type`, Playwright 29/29
      (`apps/web/e2e/*.spec.ts`, повний стек піднято руками). Nest `src/`
      не чіпав; додано лише `test/e2e/seed-web-e2e.ts`. Не закомічено.

### Зріз 9 — Redis-поліш

- [x] OTP rate-limit по IP **і** по email окремо (2026-08-29, uncommitted).
      `ChallengeService.allowRequest(email, ip)` — один Lua-скрипт бампає обидва
      лічильники за один round-trip, ставить `PEXPIRE` кожному при першій появі
      у вікні, повертає `1` лише коли обидва в межах, `0` щойно будь-який
      перевищено (обидва INCR-яться завжди). Ключі `otp:email:{email}` +
      `otp:ip:{ip}` (§7), спільне вікно `AUTH_REQUEST_LIMIT_WINDOW_MS` (1год),
      ліміти `AUTH_REQUEST_LIMIT_PER_EMAIL`=5 / новий
      `AUTH_REQUEST_LIMIT_PER_IP`=20. IP тече `AuthController.requestCode`
      (`request.ip`, поважає `TRUST_PROXY`) → `AuthService.requestLoginCode`
      → `RequestLoginCodeCommand.ip` → handler → service. Тести: challenge
      service ispec (+2 per-IP), request-login-code handler ispec (+1 per-IP),
      auth.controller ispec (+1 e2e per-IP; `beforeEach` чистить `otp:ip:*` —
      loopback IP спільний між тестами). unit 446/446, integration 139/139,
      type + biome зелені.

---

## 15. Прибирання

- ~~`src/entrypoints/cron/scraper/`~~ — видалено (зріз 0).
- ~~`new/asd.py` + `new/requirements.txt`~~ — перенесено в `nlp-service/`
  (`app.py` + pinned `requirements.txt`), `new/` прибрано з кореня (зріз 2).
- `draft/` — лишається як eval-харнес; тримати синхронним із реальним
  пайплайном.
- Старий закомічений `PLAN.md` (розділ «Working notes») — джерело для
  розділу 12; після переносу цінності не має.
