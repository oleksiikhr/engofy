---
slug: site-redesign
title: Редизайн apps/web у Direction C
base_branch: main
created: 2026-09-19
status: in-progress
---

# Редизайн apps/web у Direction C

## Context

Пост-рідер уже перемальований у теплу палітру (`.theme-reader`, PR #47–#51), решта сайту досі на
індиго-палітрі з Manrope/Public Sans. Мета — один стиль на весь сайт, світла й темна теми.

Джерело дизайну: артефакт https://claude.ai/artifact/FhdVcaCX5xaEWrhS7BusmS (`Main.dc.html` — рідер,
`Kit.dc.html` — палітра/компоненти/картки/форми, `Quiz.dc.html` — Quick check; кожен у світлій та
темній версії). `project/theme.css` в артефакті — джерело токенів і класів компонентів; його
читати через `Artifact` `read` з `path: project/theme.css`.

Рішення:
- Без кастомних шрифтів: системний стек `ui-rounded, "SF Pro Rounded", system-ui, …`. Усі woff2 з
  `apps/web/src/styles/fonts/` видаляються (стрибки тексту під час завантаження).
- Обидві теми обов'язкові. Вибір користувача (auto/light/dark) і всі налаштування, що можуть блимати
  (режим тулбара рідера, службові слова, розмір тексту), лежать у localStorage й застосовуються
  інлайн-скриптом у `<head>` до першого малювання.
- Навігація: Posts, Practice (бейдж кількості карток на повторення), Dictionary, Grammar. Today в
  навігації немає; `/` лишається як є й доступна з логотипа. Pricing у footer. Праворуч streak і
  аватар (перша літера) з меню: Profile, Progress, Subscription, тема Auto/Light/Dark, Log out.
- Word types: 4 кольорові групи (noun, verb, adjective, adverb) + перемикач «Function words»
  (PRON/DET/ADP/CCONJ/SCONJ/PART/NUM), нейтральне пунктирне підкреслення.
- Практика під постом («Quick check») — одна картка, одне питання за раз, замість довгого скролу.
- Контраст тексту на кольорових заливках ≥4.5:1 в обох темах; колір не єдиний носій інформації.
- Кожен слайс тримає e2e (`apps/web/e2e`, page objects) зеленими.

## Зрізи

### [x] 1. Tokens, no custom fonts, shared atoms
- Branch: `site-redesign-01-tokens-and-atoms`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/62

Палітра Direction C (світла + темна) замість поточної; системний шрифт замість Manrope, Public Sans,
Baloo 2, Nunito, IBM Plex Mono (видалити woff2 і `@font-face`); `.theme-reader` і `bodyClass`
зникають, тема діє на весь сайт. Атоми з `theme.css` макета: `.btn` (primary/sec/ghost/danger,
sm/lg), `.card`, `.badge`, `.tag`, інпути, тумблер, сегмент, скелетон, `prefers-reduced-motion`.
Чекпоінт дизайну: скріншот рідера у світлій і темній темі порівнюється з макетом до слайса 2.

### [x] 2. Theme and preferences without flash
- Branch: `site-redesign-02-theme-prefs-no-flash`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/63

Інлайн-скрипт у `<head>` Layout читає localStorage (`theme`: auto/light/dark; режим тулбара рідера;
службові слова; розмір тексту) і ставить атрибути на `<html>` до першого малювання. Спільний helper
для читання/запису значень. Обгортки localStorage в try/catch. E2E: перезавантаження зі збереженою
темною темою без спалаху світлої. Самі перемикачі з'являться в слайсах 3 і 4.

### [x] 3. Shell: header, avatar menu, footer
- Branch: `site-redesign-03-shell`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/64

Шапка з макета: логотип, Posts / Practice (бейдж due-count з наявного ендпоінта) / Dictionary /
Grammar, streak, аватар з першою літерою. Меню аватара: Profile, Progress, Subscription, перемикач
теми (слайс 2), Log out; відкривається без залежності від JS (`<details>` або popover), закривається
по Esc, керується з клавіатури. Гостьова шапка: Log in / Get started. Footer з Pricing, Terms,
Privacy (Terms і Privacy — коли з'являться сторінки). Today прибрано з навігації, Pricing з шапки.

### [x] 4. Reader port
- Branch: `site-redesign-04-reader`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/65

Рідер на нових токенах: чипи слів і граматики, попапи, тулбар, легенда Word types. Перемикач
«Function words» (нова група `fn` у `reader-tokens.ts`, пунктирне підкреслення) і контроль розміру
тексту A−/A+. Стан тулбара, службових слів і розміру зберігається (слайс 2). Чекпоінт дизайну:
скріншоти проти макета, світла й темна теми.

### [x] 5. Quick check core
- Branch: `site-redesign-05-quick-check-core`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/66

Замість блоку питань під постом (`reader-final`): одна картка, одне питання за раз, прогрес-смужка,
клавіші 1–3 і Esc, Skip. Екран відповіді з поясненням, підсумок (кільце результату, streak, кількість
карток на повторення). Тип «вибери форму» на наявних контрастних питаннях. Mark-read лишається як
є (перегляд фінального блоку або завершення study mode).

### [x] 6. Quick check: recall and match
- Branch: `site-redesign-06-quick-check-recall-match`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/67

Типи «картка слова» (оцінки Again/Hard/Good/Easy через наявний review) і «пари слово—значення» з
лексикону поста. Перед початком перевірити, що всі дані вже приходять у відповіді get-post-detail;
якщо ні, це зміна контракту і слайс ділиться за правилом «додати → мігрувати → прибрати».

### [x] 7. Posts, Practice, Dictionary
- Branch: `site-redesign-07-posts-practice-dictionary`
- Base: `main`
- PR: https://github.com/oleksiikhr/engofy/pull/68

Список постів (картки в трьох станах, пошук, пілі рівнів A1–C2, Unread only), Practice (типи карток,
картка з рейтингом, клавіатурні підказки), Dictionary і детальні сторінки слів/фраз. Скелетони для
htmx-списків.

### [ ] 8. Grammar
- Branch: `site-redesign-08-grammar`
- Base: `site-redesign-07-posts-practice-dictionary`
- PR: —

Список тем, `GrammarShell` і компоненти (Formula, Example, Compare, UsagePoints, Section), 4
статичні сторінки, `grammar/[slug]`.

### [ ] 9. Profile, Progress, Subscription
- Branch: `site-redesign-09-profile-progress-subscription`
- Base: `site-redesign-08-grammar`
- PR: —

Профіль (рівень складності, видалення акаунта), Progress (heatmap, картки за рівнями, граматичні
навички), Subscription. Кільце денної цілі біля streak: якщо потрібні нові дані від бекенду, це
окремий слайс за контрактним правилом.

### [ ] 10. Pricing, Login, Today, account-deletion
- Branch: `site-redesign-10-pricing-login-today`
- Base: `site-redesign-09-profile-progress-subscription`
- PR: —

Pricing (Free / Premium), Login (код з 6 полів, Google), гостьовий лендінг, онбординг і денний план
на `/`, сторінка скасування видалення акаунта.

### [ ] 11. Mobile and final audit
- Branch: `site-redesign-11-mobile-audit`
- Base: `site-redesign-10-pricing-login-today`
- PR: —

Мобільна верстка всіх сторінок (меню, тулбар рідера, Quick check під великий палець) за окремим
мобільним макетом, який малюється в тому ж артефакті перед цим слайсом. Аудит контрасту й фокусу,
e2e-прохід у світлій та темній темі.
