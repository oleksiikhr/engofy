---
slug: enforce-db-foreign-keys
title: Справжні FK у БД замість голих uuid-колонок
base_branch: main
created: 2026-09-20
status: in-progress
---

# Справжні FK у БД замість голих uuid-колонок

Правило E7 (`.agents/skills/engofy/references/mikroorm.md`) вимагає, щоб зовнішні ключі були голими
`@Property({ type: 'uuid' })` колонками, тож у застосункових таблицях немає жодного FK (лише `pgboss`).
Наслідок: осиротілі рядки (у dev-БД `daily_plans.post_id` 11/12, `post_reads.post_id` 60/67) і 500 на
головній, коли пост зник. Рішення: FK у БД скрізь, крім `auth_sessions` і `auth_challenges`
(`auth_challenges` ключується по email, колонки `*_id` там нема). Зв'язків `@ManyToOne` з навігацією в
ORM не додаємо: у сутності лишається скаляр `string` через
`@ManyToOne(() => X, { mapToPk: true, deleteRule })`.

Продакшену ще нема, тож зворотна сумісність не потрібна: осиротілі рядки в міграціях просто
видаляються, старі міграції можна не зберігати як історію, якщо це спрощує.

Щоб не правити ~40 `ispec` вручну ще тричі, спершу (зрізи 2-3) всі фікстури переводяться на `Factory` з
`@mikro-orm/seeder`; FK-зрізи 4-6 потім лише додають FK й підправляють фабрики.

Політика `ON DELETE`: `CASCADE` для всього, що належить юзеру або посту; `RESTRICT` для довідників
(`grammar_usage_points`, `grammar_constructions`, `words`, `word_definitions`, `phrases`).

## Зрізи

### [x] 1. Спайк і правило
- Branch: `enforce-db-foreign-keys-01-fk-spike`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/93

Перевірити, що `mapToPk` + `deleteRule` на `daily_plans.post_id` дає FK у міграції та чистий
`migration:check`. Вибрати для тестів `deferMode: INITIALLY_DEFERRED` або виправлення ~40 `ispec` із
випадковими uuid-батьками. Переписати E7 у `mikroorm.md` з двома винятками (`auth_sessions`,
`auth_challenges`), додати в `migrations.md` патерн «видалити сиріт → додати FK». Сюди ж входить фікс
осиротілих daily-планів (`get-daily-plan` / `create-daily-plan` + тести), який уже лежить у робочому
дереві; після каскаду гілка «осиротілий план» стає мертвою, тож вирішити, чи лишати її як захист.

### [x] 2. Фабрики: інфраструктура і перші модулі
- Branch: `enforce-db-foreign-keys-02-factories-core`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/94

Усі фікстури в тестах створюються через `Factory` з `@mikro-orm/seeder` (уже є в devDependencies),
`test/factories/<entity>.factory.ts`, по одній фабриці на сутність з детермінованими дефолтами в
`definition()` (без faker). `definition()` синхронний і не створює батьків: тест сам створює батька
(`postFactory.createOne()`) і передає його id (`postId: post.id`). Реалізувати фабрики для всіх сутностей
застосунку, спільний спосіб отримати їх із `suite` (наприклад `factories(suite.orm.em)`), перевести на
них ispec модулів `home`, `auth`, `billing`, `learning`, прибрати `test/helpers/seed-post.helper.ts`
(його замінює `PostFactory`) і локальні `seedPost`/`em.create` у цих модулях. Додати правило в
reference про тести (`.agents/skills/engofy/references/`): нові фікстури тільки через фабрики.

### [x] 3. Фабрики: решта тестів
- Branch: `enforce-db-foreign-keys-03-factories-rest`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/95

Перевести на фабрики решту: ispec модулів `post`, `telegram`, `entrypoints/**` (web, worker, cli),
`test/e2e/seed-web-e2e.ts`. Прибрати всі локальні `seedPost*`/`seed*`-функції, що дублюють фабрики;
залишаються лише сценарні хелпери, які збирають кілька фабрик разом (наприклад «пост із реченням і
токеном»), і вони самі викликають фабрики. Перевірити `grep`-ом, що в `*.ispec.ts` не лишилося прямих
`em.create(<Entity>, …)` для сутностей, які мають фабрику.

### [ ] 4. Агрегат поста
- Branch: `enforce-db-foreign-keys-04-post-aggregate`
- Base: `enforce-db-foreign-keys-03-factories-rest`
- PR: —

`CASCADE` для `sentences`, `post_parts`, `exercises`, `post_pipeline_runs`, `post_publications`,
`sentence_tokens`, `grammar_matches`, `post_reads.post_id`, `daily_plans.post_id`. Звірити ручні
`nativeDelete` у `retry-post`, `generate-exercises`, `tag-grammar` з новими правилами.

### [ ] 5. Дані юзера
- Branch: `enforce-db-foreign-keys-05-user-data`
- Base: `enforce-db-foreign-keys-04-post-aggregate`
- PR: —

`CASCADE` для `subscriptions`, `learning_cards`, `learning_dispositions`, `user_skill_progress`,
`post_reads.user_id`, `daily_plans.user_id`, `account_deletion_requests`, `review_logs → learning_cards`.
`auth_sessions.user_id` не чіпаємо. Спростити ручне видалення в `delete-expired-accounts`.

### [ ] 6. Довідники
- Branch: `enforce-db-foreign-keys-06-reference-data`
- Base: `enforce-db-foreign-keys-05-user-data`
- PR: —

`RESTRICT` для посилань на `grammar_usage_points`, `grammar_constructions`, `words`, `word_definitions`,
`phrases` (`grammar_matches`, `learning_cards`, `learning_dispositions`, `daily_plans`,
`user_skill_progress`, `sentence_tokens`, `word_definitions.word_id`, `grammar_usage_points.construction_id`,
`grammar_constructions.category_id`). Перевірити, що перезаливка довідників (seed EGP) не ламається.
