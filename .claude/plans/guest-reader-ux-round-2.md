---
slug: guest-reader-ux-round-2
title: Гостьовий рідер, раунд 2
base_branch: main
created: 2026-09-20
status: in-progress
---

# Гостьовий рідер, раунд 2

## Контекст

Повторне гостьове рев'ю після плану `guest-reader-ux-overhaul` показало: механіка рідера працює, але
гість не має причини увійти, мобільний екран перевантажений службовими плашками, головна розповідає
про рідер замість того, щоб його показати, граматичний довідник виглядає стіною з 97 карток, а
рівень гостя не впливає на добір текстів.

Не входить у план: переклад решти інтерфейсу, вправи до граматики, підпис оригіналу, нагадування
через Telegram, наповнення контентом.

## Продакшену ще немає

Продакшену немає, реальних користувачів і даних теж. Зворотна сумісність, порядок деплою і
expand-contract не потрібні. Жоден зріз не змінює контракти (БД, API, черги): усі зрізи лише в
`apps/web`; рівень гостя вже лежить у cookie `reader-level`, яку читає SSR.

## Зрізи

### [x] 1. Заклик увійти для гостя
- Branch: `guest-reader-ux-round-2-01-guest-signup-nudge`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/120

Лічильник збережених карток біля кільця цілі в хедері. Одноразова плашка після 3-ї збереженої картки
або 10 досліджених слів: «Ти зберіг N слів, увійди, щоб вони не пропали» з переходом на `/login`.
Плашку можна закрити, повторно вона не показується. Гостьова колода вже переноситься в акаунт після
входу (`guest-deck.ts`), зріз лише додає момент, коли про це нагадують.

### [x] 2. Мобільний рідер: менше плашок і нижній лист
- Branch: `guest-reader-ux-round-2-02-mobile-reader-density`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/121

Рівень, підказка, легенда й «You've explored N words» зводяться в один згортаємий рядок над текстом.
На ≤480px картка слова стає нижнім листом, щоб не закривати речення, яке читаєш. Скріншоти до/після
на 390px у PR.

### [x] 3. Головна: робочий міні-рідер і чистка Pricing
- Branch: `guest-reader-ux-round-2-03-home-live-reader`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/122

Прибрати дубль заголовка й підзаголовка героя. Замінити три скріншоти на інтерактивний фрагмент
рідера з 2–3 речень: слова клікабельні, дані картки вбудовані в сторінку, без запитів до API. Прибрати
«skills tree» зі сторінки Pricing, бо такої функції немає. Скріншоти в PR.

### [x] 4. Граматика: навігація
- Branch: `guest-reader-ux-round-2-04-grammar-navigation`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/123

Пошук по конструкціях у `grammar.astro`. Конструкції з `usagePointCount === 0` не показувати. Блок
«Start here» для гостя бере рівень із cookie `reader-level` замість фіксованого A1. Прибрати плейсхолдер
«Practice exercises for this use are coming soon» з `GrammarUsagePoints.astro`.

### [ ] 5. Слухання всього тексту
- Branch: `guest-reader-ux-round-2-05-listen-whole-text`
- Base: `guest-reader-ux-round-2-04-grammar-navigation`
- PR: —

Кнопка «Listen» у тулбарі рідера: безперервне озвучення блок за блоком (Web Speech API), підсвітка
поточного блоку, пауза й стоп; озвучення зупиняється при виході зі сторінки. Спирається на наявні
`reader-listen.ts` і `speech.ts`. Без підтримки speech synthesis кнопки немає.

### [ ] 6. Рекомендації за рівнем
- Branch: `guest-reader-ux-round-2-06-level-recommendations`
- Base: `guest-reader-ux-round-2-05-listen-whole-text`
- PR: —

Головна («Latest texts») і список Posts підлаштовуються під cookie `reader-level`: показуються тексти
рівня ±1 через наявний параметр `cefr`, з чіпом «For your level» і кнопкою «Show all». Без cookie
поведінка не змінюється. Явно вибрані чипи рівня мають пріоритет над cookie.
