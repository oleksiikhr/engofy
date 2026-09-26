---
slug: reader-token-analysis-unify
title: Узгодження шарів token-level аналізу в reader'і
base_branch: main
created: 2026-09-26
status: in-progress
---

# Узгодження шарів token-level аналізу в reader'і

## Контекст

Reader (`apps/web/src/pages/posts/[slugId].astro`) має чотири незалежні шари
позначення слів, кожен зі своїм правилом "що позначати", і вони не узгоджені
між собою — звідси відчуття "неповноцінної" логіки:

1. **"Word types" toggle** (`apps/web/src/lib/render-tokens.ts` `POS_GROUP`) —
   фарбує лише noun/verb/adj/adv; pron/det/adp/cconj/sconj/part/num/interj без
   кольору взагалі.
2. **"Tenses" toggle** (`src/modules/post/domain/analyze-token.ts`
   `tokenTense`) — дає past/present/future ЛИШЕ фінітному дієслову
   (`VerbForm=Fin`); non-finite форми (participle, gerund) нічого не
   отримують; aspect (continuous/perfect) і "going to future" не позначаються
   взагалі. Це і плутає користувача: у "had drawn" grammar-шар підсвічує
   фразу цілком як одну EGP-конструкцію (Past Perfect), а Tenses-шар дає лінію
   лише "had".
3. **Grammar usage points** (EGP constructs, `apply-grammar-constructs.ts` /
   `apply-grammar-matches.ts`) — окремий завжди-активний шар, коректно
   покриває фразу цілком; логіку матчингу не змінюємо.
4. **Click-to-explain popup** (`apps/web/src/lib/reader-popup.ts`,
   `LEXICAL_SELECTOR`) — спрацьовує лише коли токен має запис у
   `word_definition`/`phrase`. Функціональні слова ("the", "a", прийменники)
   без словникової статті — не клікабельні взагалі (крім як частина grammar-
   конструкції).

Цільовий користувач читає на рівні A1 (і нижче) і хоче клікати на БУДЬ-ЯКЕ
слово в тексті й розуміти що це і чому воно тут, включно з "the" та іншими
функціональними словами.

## Ухвалені рішення

- Click-popup відкривається для КОЖНОГО токена. Токен без word_definition/
  phrase отримує легкий fallback: частина мови людською мовою + короткий
  типовий шаблон ролі в реченні (напр. "the" → визначений артикль, вказує на
  конкретний/уже відомий предмет) — НЕ повноцінна словникова стаття, і без
  звернення до AI/LLM (лінгвістика детермінована в TS — nlp.md правило N1).
- Tense-шар розширюється до tense+aspect (simple/continuous/perfect/perfect-
  continuous), плюс "going to future", деривативно з уже наявних колонок
  `sentence_tokens` (`pos`, `tag`, `dep`, `headPosition`, `morph`) — без нової
  колонки/міграції. Увесь aux-ланцюжок однієї verb-групи ("had" + "drawn")
  отримує один узгоджений tense+aspect, а не лише фінітний токен.
- Word-types кольори розширюються так, щоб кожен токен мав видиму категорію:
  функціональні слова (det/pron/adp/cconj/sconj/part/num/interj) групуються в
  одну візуально приглушену групу, не 8 окремих кольорів.
- Analyze mode показує підпис під КОЖНИМ токеном (розслідувати й виправити
  причину поточної прогалини — рендер-баг чи відсутність fallback-даних).
- Жодна зміна не потребує міграції БД: усе похідне від уже збережених полів
  `SentenceToken`.

## Зрізи

### [ ] 1. Backend: tense + aspect на рівні групи дієслова
- Branch: `reader-token-analysis-unify-01-tense-aspect`
- Base: `main`
- PR: —

Розширити `analyze-token.ts` / `locate-sentence-tokens.ts` детермінованим
детектором verb-групи (aux-ланцюжок через `dep`/`headPosition`): обчислює
`aspect` (simple/continuous/perfect/perfect-continuous) і "going to future", і
присвоює однаковий tense+aspect+verbGroupId усім токенам групи, а не лише
фінітному дієслову. Існуюче поле `tense` лишається (лише додаємо поля) — DTO
`get-post-detail` і `apps/web` типи не ламаються в цьому зрізі. Юніт-тести на
всі 4 aspect × 3 tense + going-to future.

### [ ] 2. Backend: fallback-пояснення ролі слова без словникової статті
- Branch: `reader-token-analysis-unify-02-role-fallback`
- Base: `reader-token-analysis-unify-01-tense-aspect`
- PR: —

Новий детермінований модуль: за (pos, tag, lemma) — короткий людський опис
частини мови + типова роль у реченні; окремі записи для найчастотніших
функціональних лем (the/a/an/to/and/of/…). Додається в DTO `get-post-detail`
як необов'язкове поле на `annotations.tokens`, заповнюється лише коли токен ще
не має `word_definition`/`phrase`. Юніт-тести на кожну POS-групу.

### [ ] 3. apps/web: click-popup працює на кожному слові
- Branch: `reader-token-analysis-unify-03-click-every-word`
- Base: `reader-token-analysis-unify-02-role-fallback`
- PR: —

`reader-popup.ts`: `targetFor()` падає на будь-який `data-tok`, коли
word/phrase entry немає. `reader-lexicon.ts` рендерить легкий fallback-попап
(частина мови + роль + tense/aspect для дієслів) замість повної словникової
картки. `render-tokens.ts` позначає tabindex/role на всіх `data-tok`, не лише
лексичних. CSS: стриманий "clickable"-афорданс для звичайного слова, щоб не
виглядало як повний словниковий хайлайт.

### [ ] 4. apps/web: узгодження Word types / Tenses / Analyze
- Branch: `reader-token-analysis-unify-04-unify-modes`
- Base: `reader-token-analysis-unify-03-click-every-word`
- PR: —

`render-tokens.ts` `POS_GROUP` отримує п'яту, візуально приглушену групу
"function word". Тулбар "Tenses" показує tense+aspect і фарбує всю verb-групу
однаково (виправляє "had" без "drawn"). Analyze mode: підпис під КОЖНИМ
токеном (виправити причину поточної прогалини). Оновлення легенди/тултипів у
`[slugId].astro`.

### [ ] 5. Dev-seed скрипт для локальної dev-бази
- Branch: `reader-token-analysis-unify-05-dev-seed`
- Base: `reader-token-analysis-unify-04-unify-modes`
- PR: —

Нова CLI-підкоманда (за шаблоном `test/e2e/seed-web-e2e.ts`) — кілька постів
різних CEFR-рівнів з вручну побудованим деревом + `sentence_tokens`, що
навмисно покривають усе з зрізів 1-4: усі POS-групи (вкл. функціональні
слова), усі tense×aspect + going-to future, кілька grammar usage points,
exercises усіх типів. Ідемпотентний, без spaCy/AI викликів, працює на dev DB.
