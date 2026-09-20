import { expect, type Page, type Route, test } from '@playwright/test';
import { AUTHED_STATE, DECK_STATE } from './auth';
import { ReaderPage } from './pages/reader-page';

// Slice 8b page 1 — /posts/{slug}-{id}: node-tree reading. Every word/phrase
// span carries a `data-word-definition-id` / `data-phrase-id` label and every
// grammar match a `data-grammar-usage-point-id` label; ones whose effective
// state for the viewer is learned/skipped also carry `data-known` (clickable,
// not highlighted).
// Fixtures come from test/e2e/seed-web-e2e.ts (global-setup): word
// "perambulate", phrases "at loose ends" and "a piece of cake" (the seeded
// user marked it Known), grammar "past perfect" matched on "had drawn" and
// the "reported" usage point (the seeded user marked it Known) on "war ended".

const READER_SLUG = 'the-cartographer-at-dawn-E2Eread1';
const BASE_URL = process.env.WEB_BASE_URL ?? 'http://localhost:4321';

test.describe('reader page (guest)', () => {
  test('renders the article body with sparse labels on new words and phrases', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await reader.expectLoaded('The Cartographer at Dawn');

    await expect(reader.badge).toHaveText('B1');
    await expect(
      page.getByRole('link', { name: 'https://example.com/the-cartographer' }),
    ).toBeVisible();

    await expect(reader.analysis).toContainText('perambulate');
    // A guest has no cards or dispositions, so every word/phrase is New.
    await expect(reader.wordLabel('perambulate')).toHaveCount(1);
    await expect(reader.phraseLabel('at loose ends')).toHaveCount(1);
    await expect(reader.phraseLabel('a piece of cake')).toHaveCount(1);
    await expect(reader.grammarLabel('had drawn')).toHaveCount(1);
    await expect(reader.grammarLabel('war ended')).toHaveCount(1);
    await expect(page.locator('.sidebar')).toHaveCount(0);
  });

  test('shows the tap hint and highlight key, and the hint stays dismissed', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const hint = page.locator('.reader-hint');
    await expect(hint).toBeVisible();
    await expect(page.locator('.reader-key')).toContainText('Grammar');

    // Dismissing collapses the hint; the article must glide, not jump.
    await page.evaluate(() => {
      const w = window as unknown as { __ys: number[] };
      w.__ys = [];
      const sample = () => {
        w.__ys.push(
          document.querySelector('.reading-body')?.getBoundingClientRect()
            .top ?? 0,
        );
        requestAnimationFrame(sample);
      };
      sample();
    });
    await hint.getByRole('button', { name: 'Dismiss hint' }).click();
    await expect(hint).toBeHidden();
    const ys = await page.evaluate(
      () => (window as unknown as { __ys: number[] }).__ys,
    );
    const steps = ys.slice(1).map((y, i) => Math.abs(y - ys[i]));
    expect(ys.at(-1)).toBeLessThan(ys[0]);
    expect(Math.max(...steps)).toBeLessThan(25);
    await page.reload();
    await expect(hint).toBeHidden();
  });

  test('highlight density switches between new-for-me, all and none', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const word = reader.wordLabel('perambulate');
    const paint = () =>
      word.evaluate((el) => getComputedStyle(el).backgroundColor);
    const key = page.locator('.reader-key');

    // The seeded word is above the guest's level: highlighted by default.
    const lit = await paint();
    expect(lit).not.toBe('rgba(0, 0, 0, 0)');

    await key.getByRole('button', { name: 'None' }).click();
    await expect(page.locator('html')).toHaveAttribute(
      'data-reader-density',
      'off',
    );
    expect(await paint()).toBe('rgba(0, 0, 0, 0)');

    await key.getByRole('button', { name: 'All' }).click();
    expect(await paint()).toBe(lit);

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute(
      'data-reader-density',
      'all',
    );
    await key.getByRole('button', { name: 'New for me' }).click();
    await expect(page.locator('html')).not.toHaveAttribute(
      'data-reader-density',
      /.*/,
    );
  });

  test('opens an anchored popup on a word without shifting the article', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await expect(reader.popup).toBeHidden();
    const before = await reader.analysis.boundingBox();

    const word = reader.wordLabel('perambulate');
    await word.click();
    await expect(reader.popup).toBeVisible();
    await expect(reader.popup.locator('.lex-popup__term')).toHaveText(
      'perambulate',
    );
    await expect(reader.popup.locator('.lex-popup__def')).not.toBeEmpty();
    expect(await reader.analysis.boundingBox()).toEqual(before);

    // Anchored: horizontally overlapping the clicked span, touching its edge.
    const popupBox = await reader.popup.boundingBox();
    const wordBox = await word.boundingBox();
    if (!popupBox || !wordBox) {
      throw new Error('popup or word has no box');
    }
    expect(popupBox.x).toBeLessThan(wordBox.x + wordBox.width);
    expect(popupBox.x + popupBox.width).toBeGreaterThan(wordBox.x);

    await page.keyboard.press('Escape');
    await expect(reader.popup).toBeHidden();
  });

  test('opens the popup for a phrase and swaps it for another', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.wordLabel('perambulate').click();
    await reader.phraseLabel('at loose ends').click();
    await expect(reader.popup.locator('.lex-popup__term')).toHaveText(
      'at loose ends',
    );
    await expect(reader.popup).toHaveCount(1);

    await page.mouse.click(2, 2);
    await expect(reader.popup).toBeHidden();
  });

  test('switches popup definitions to Ukrainian and remembers the choice', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.wordLabel('perambulate').click();
    const translation = reader.popup.locator('.lex-popup__translation');
    await expect(translation).toHaveCount(0);

    await reader.popup.getByRole('button', { name: 'УКР' }).click();
    await expect(reader.popup).toBeVisible();
    await expect(translation).toHaveText('прогулюватися, прогулюватись');
    await expect(reader.popup.locator('.lex-popup__def')).not.toBeEmpty();

    // The choice carries to a phrase, a grammar label and a reloaded page.
    await reader.phraseLabel('at loose ends').click();
    await expect(translation).toHaveText('не знати, чим зайнятися');
    await reader.grammarLabel('had drawn').click();
    await expect(reader.popupSection('grammar')).toContainText(
      'яка з двох минулих дій сталася раніше',
    );

    await page.reload();
    await reader.wordLabel('perambulate').click();
    await expect(translation).toHaveText('прогулюватися, прогулюватись');

    await reader.popup.getByRole('button', { name: 'EN' }).click();
    await expect(translation).toHaveCount(0);
  });

  test("keeps a guest's saved card in the browser and shows it as Learning", async ({
    page,
  }) => {
    let serverAdds = 0;
    await page.route('**/partials/lexicon-action', (route) => {
      serverAdds += 1;
      return route.abort();
    });
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.wordLabel('perambulate').click();
    await reader.popup.getByRole('button', { name: 'Add to deck' }).click();
    await expect(reader.popup.locator('.lex-state--learning')).toBeVisible();
    await expect(
      reader.popup.getByRole('link', { name: 'Sign in' }),
    ).toHaveCount(0);
    const id = await reader
      .wordLabel('perambulate')
      .getAttribute('data-word-definition-id');
    const stored = await page.evaluate(() =>
      localStorage.getItem('guest-deck'),
    );
    expect(JSON.parse(stored ?? '[]')).toEqual([{ kind: 'word', id }]);

    // The label stays highlighted, and reopening it after a reload still
    // shows the saved state.
    await page.reload();
    await reader.wordLabel('perambulate').click();
    await expect(reader.popup.locator('.lex-state--learning')).toBeVisible();
    await expect(
      reader.popup.getByRole('button', { name: 'Add to deck' }),
    ).toHaveCount(0);
    expect(serverAdds).toBe(0);
  });

  test('still asks a guest to sign in for "I know it"', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.wordLabel('perambulate').click();
    await reader.popup.getByRole('button', { name: 'I know it' }).click();
    await expect(
      reader.popup.getByRole('link', { name: 'Sign in' }),
    ).toBeVisible();
  });

  test('the Quick check intro is only as tall as its content', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const intro = await reader.qcScreen('intro').boundingBox();
    await reader.startQuickCheck();
    const question = await reader.qcScreen('question').boundingBox();
    if (!intro || !question) {
      throw new Error('quick check screens have no box');
    }
    expect(intro.height).toBeLessThan(question.height);
  });

  test('the Quick check summary invites a guest to sign up', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        'guest-deck',
        JSON.stringify([{ kind: 'word', id: 'x' }]),
      ),
    );
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader
      .qcScreen('intro')
      .getByRole('button', { name: 'Skip for now' })
      .click();
    const summary = reader.qcScreen('summary');
    await expect(summary.locator('[data-qc-signup]')).toContainText(
      'Keep what you learned',
    );
    await expect(summary.locator('[data-guest-saved]')).toHaveText(
      'You saved 1 card here.',
    );
    await expect(
      summary.getByRole('link', { name: 'Sign up free' }),
    ).toHaveAttribute('href', '/login');
  });

  test('the header shows the reading time and the badge explains the level', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await expect(page.locator('[data-reading-time]')).toHaveText(
      /^\d+ min read$/,
    );
    const note = page.locator('[data-level-note]');
    await expect(note).toBeHidden();
    await reader.badge.click();
    await expect(note).toContainText('Intermediate');
    await expect(reader.badge).toHaveAttribute('aria-expanded', 'true');
    await reader.badge.click();
    await expect(note).toBeHidden();
  });

  test('the progress bar follows the scroll through the article', async ({
    page,
  }) => {
    // A viewport shorter than the article, so there is something to scroll.
    await page.setViewportSize({ width: 390, height: 300 });
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const bar = page.locator('[data-reader-progress]');
    const start = Number(await bar.getAttribute('aria-valuenow'));
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect
      .poll(async () => Number(await bar.getAttribute('aria-valuenow')))
      .toBeGreaterThan(start);
    await expect
      .poll(async () => Number(await bar.getAttribute('aria-valuenow')))
      .toBe(100);
  });

  test('the summary recaps the words and grammar and offers the next text', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader
      .qcScreen('intro')
      .getByRole('button', { name: 'Skip for now' })
      .click();
    const summary = reader.qcScreen('summary');
    const seen = summary.locator('[data-qc-seen]');
    await expect(seen).toContainText('Words and phrases');
    await expect(seen).toContainText('perambulate');
    await expect(seen).toContainText('Grammar you saw');
    await expect(seen).toContainText('Past perfect');

    const next = summary.locator('[data-qc-next]');
    await expect(next).toContainText('Next text · B1');
    await expect(next).not.toContainText('The Cartographer at Dawn');
    await expect(next).toHaveAttribute('href', /^\/posts\/.+/);
  });

  test('"I know it" settles the target and drops its label', async ({
    page,
  }) => {
    // Stubbed so the seeded user's data stays untouched.
    await page.route('**/partials/lexicon-action', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<div class="lex-actions" id="x"><span class="lex-state lex-state--learned" data-state="learned">Learned</span></div>',
      }),
    );
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.wordLabel('perambulate').click();
    await reader.popup.getByRole('button', { name: 'I know it' }).click();
    await expect(reader.popup.locator('.lex-state')).toHaveText('Learned');
    await expect(reader.wordLabel('perambulate')).toHaveCount(0);
    await expect(reader.knownLabel('word', 'perambulate')).toHaveCount(1);
  });

  test('opens a grammar popup with guideword, explanation and example', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const label = reader.grammarLabel('had drawn');
    await label.click();
    await expect(reader.popup).toBeVisible();
    const section = reader.popupSection('grammar');
    await expect(section.locator('.lex-popup__kicker')).toHaveText('Grammar');
    await expect(section.locator('.lex-popup__term')).toHaveText(
      'Past perfect',
    );
    await expect(section.locator('.lex-popup__sub')).toHaveText('Earlier past');
    await expect(section.locator('.lex-popup__def')).toContainText(
      'which of two past actions happened first',
    );
    await expect(section.locator('.lex-popup__example')).toHaveText(
      'She had drawn the map before he arrived.',
    );
    await expect(reader.popupSection('word')).toHaveCount(0);

    const popupBox = await reader.popup.boundingBox();
    const labelBox = await label.boundingBox();
    if (!popupBox || !labelBox) {
      throw new Error('popup or label has no box');
    }
    expect(popupBox.x).toBeLessThan(labelBox.x + labelBox.width);
    expect(popupBox.x + popupBox.width).toBeGreaterThan(labelBox.x);

    await section.getByRole('button', { name: 'Add to deck' }).click();
    await expect(section.locator('.lex-state--learning')).toBeVisible();
  });

  test('shows lexical and grammar sections when the labels overlap', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.phraseLabel('a piece of cake').click();
    await expect(reader.popup.locator('section')).toHaveCount(2);
    await expect(reader.popup.locator('section').first()).toHaveAttribute(
      'data-lex-kind',
      'phrase',
    );
    await expect(reader.popup.locator('section').last()).toHaveAttribute(
      'data-lex-kind',
      'grammar',
    );
    await expect(reader.popup.locator('.lex-popup__divider')).toHaveCount(1);
    await expect(
      reader.popupSection('phrase').locator('.lex-popup__term'),
    ).toHaveText('a piece of cake');
    await expect(
      reader.popupSection('grammar').locator('.lex-popup__term'),
    ).toHaveText('Past perfect');
  });

  test('"I know it" on the grammar section drops only the grammar label', async ({
    page,
  }) => {
    await page.route('**/partials/lexicon-action', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<div class="lex-actions" id="x"><span class="lex-state lex-state--learned" data-state="learned">Learned</span></div>',
      }),
    );
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.phraseLabel('a piece of cake').click();
    await reader
      .popupSection('grammar')
      .getByRole('button', { name: 'I know it' })
      .click();
    await expect(
      reader.popupSection('grammar').locator('.lex-state'),
    ).toHaveText('Learned');
    await expect(reader.grammarLabel('a piece of cake')).toHaveCount(0);
    await expect(reader.knownLabel('grammar', 'a piece of cake')).toHaveCount(
      1,
    );
    await expect(reader.phraseLabel('a piece of cake')).toHaveCount(1);
    await expect(
      reader.popupSection('phrase').getByRole('button', { name: 'I know it' }),
    ).toBeVisible();
  });

  test('colours tokens by part of speech and by tense, each toggle on its own', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    // Tokens are in the server HTML, but paint nothing until a mode is on.
    await expect(reader.token('coastline')).toHaveCount(1);
    await expect(reader.token('coastline')).toHaveCSS(
      'border-bottom-width',
      '0px',
    );

    await reader.modeToggle('Word types').click();
    await expect(reader.modeToggle('Word types')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(reader.token('coastline')).toHaveAttribute(
      'data-pos-group',
      'noun',
    );
    await expect(reader.token('twice')).toHaveAttribute(
      'data-pos-group',
      'adv',
    );
    // POS mode alone paints no tense line.
    const ended = reader.token('ended');
    await expect(ended).toHaveAttribute('data-tense', 'past');
    const posOnly = await ended.evaluate(
      (el) => getComputedStyle(el).boxShadow,
    );
    expect(posOnly).toBe('none');
    await reader.modeToggle('Tenses').click();
    const both = await ended.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(both).not.toBe('none');

    // The article's own text is untouched by the wrapping.
    await expect(reader.analysis).toContainText(
      'By the time the war ended, she had drawn every coastline twice.',
    );

    await reader.modeToggle('Word types').click();
    await expect(reader.page.locator('html')).toHaveAttribute(
      'data-reader-modes',
      'tense',
    );
  });

  test('function words are never coloured and there is no Function words switch', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await reader.modeToggle('Word types').click();

    const the = reader.token('the').first();
    await expect(the).not.toHaveAttribute('data-pos-group', /.*/);
    await expect(the).toHaveCSS('border-bottom-width', '0px');
    await expect(
      reader.toolbar.getByRole('switch', { name: 'Function words' }),
    ).toHaveCount(0);
  });

  test('a stored mode is in place before hydration and hydrating moves nothing', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await page.addInitScript(() =>
      localStorage.setItem('reader-modes', 'pos tense analyze'),
    );
    const measure = () =>
      page.evaluate(() => {
        const rect = (selector: string) => {
          const r = document.querySelector(selector)?.getBoundingClientRect();
          return r && { x: r.x, y: r.y, width: r.width, height: r.height };
        };
        const paragraph = (index: number) =>
          rect(`.reading-body [data-block="${index}"]`);
        return {
          toolbar: rect('.reader-toolbar'),
          body: rect('.reading-body'),
          first: paragraph(0),
          second: paragraph(1),
        };
      });

    // Page scripts blocked: only the inline <head> boot script has run.
    const blockScripts = (route: Route) =>
      route.request().resourceType() === 'script'
        ? route.abort()
        : route.continue();
    await page.route('**/*', blockScripts);
    await reader.goto(READER_SLUG);
    await reader.expectLoaded('The Cartographer at Dawn');
    await expect(reader.modeToggle('Analyze')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(reader.modeToggle('Analyze')).toHaveCSS(
      'background-color',
      /^(?!rgba\(0, 0, 0, 0\))/,
    );
    await expect(
      reader.toolbar.locator('[data-legend="analyze"]'),
    ).toBeVisible();
    const before = await measure();

    await page.unroute('**/*', blockScripts);
    await page.reload();
    await expect(reader.modeToggle('Analyze')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await measure()).toEqual(before);
  });

  test('Analyze tags tokens, flags irregular verbs and explains the construction', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.modeToggle('Analyze').click();
    const drawn = reader.token('drawn');
    await expect(drawn).toHaveAttribute(
      'data-irregular',
      'draw – drew – drawn',
    );
    const tag = await reader
      .token('coastline')
      .evaluate((el) => getComputedStyle(el, '::after').content);
    expect(tag).toBe('"noun"');
    const flag = await drawn.evaluate(
      (el) => getComputedStyle(el, '::before').content,
    );
    expect(flag).toContain('drew');

    await reader.grammarLabel('had').first().click();
    await expect(reader.popupSection('grammar')).toBeVisible();
    await expect(
      reader.popupSection('grammar').locator('.lex-popup__contrast'),
    ).toContainText('Past perfect fits because');
  });

  test('the "why not X" text stays hidden outside Analyze mode', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.grammarLabel('had drawn').click();
    await expect(reader.popupSection('grammar')).toBeVisible();
    await expect(
      reader.popupSection('grammar').locator('.lex-popup__contrast'),
    ).toBeHidden();
  });

  test('A+ / A- resize the article text and the size is remembered', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const size = () =>
      reader.analysis.evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).fontSize),
      );

    const base = await size();
    await reader.toolbar.getByRole('button', { name: 'Larger text' }).click();
    expect(await size()).toBeGreaterThan(base);

    await page.reload();
    expect(await size()).toBeGreaterThan(base);

    await reader.toolbar.getByRole('button', { name: 'Smaller text' }).click();
    expect(await size()).toBe(base);
  });

  test('"Report a mistake" in a popup is acknowledged', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.wordLabel('perambulate').click();
    const report = reader.popupSection('word').locator('.lex-report');
    await report.getByRole('button', { name: 'Report a mistake' }).click();
    await expect(report).toContainText('Thanks');
  });

  test("Quick check offers the post's contrastive question one card at a time", async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const intro = reader.qcScreen('intro');
    await expect(intro).toContainText('One minute, 6 quick questions.');
    await expect(intro).toContainText('2×Choose the form');
    await expect(intro).toContainText('1×Match pairs');
    await expect(intro).toContainText('2×Type the answer');
    await expect(intro).toContainText('1×Put in order');
    await expect(reader.qcScreen('question')).toHaveCount(0);

    await reader.startQuickCheck();
    const question = reader.qcScreen('question');
    await expect(question).toContainText('By the time the war ended');
    await expect(question).toContainText('1/6');
    await expect(
      question.getByRole('button', { name: 'Check', exact: true }),
    ).toBeDisabled();

    await question.locator('[data-text="drew"]').click();
    await question.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(question.locator('[data-qc-verdict]')).toHaveText('Not quite');
    await expect(question.getByText('Does not show the order.')).toBeVisible();
    // The right answer is explained too, the unpicked option is not.
    await expect(question.getByText('Earlier past action.')).toBeVisible();
    await expect(question.getByText('Wrong time frame.')).toBeHidden();
    await expect(question.locator('[data-qc-blank]')).toHaveText('had drawn');

    await question.getByRole('button', { name: 'Continue' }).click();
    await expect(reader.qcQuestion('match')).toContainText('2/6');
    await reader
      .qcQuestion('match')
      .getByRole('button', { name: 'Skip quick check' })
      .click();
    await expect(reader.qcScreen('summary')).toContainText('Keep at it.');
    await expect(reader.qcScreen('summary')).toContainText('0/1');
  });

  test('Quick check match pairs marks right pairs, flags wrong ones and scores a clean run', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await reader.startQuickCheck();
    // Choose the form first: "had drawn" is option 1.
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    const match = reader.qcQuestion('match');
    await expect(match).toContainText('Match the pairs');
    await expect(match).toContainText('0 of 4');
    const next = match.getByRole('button', { name: 'Continue' });
    await expect(next).toBeHidden();

    // A wrong pair is flagged, then clears; nothing is matched.
    await match
      .locator('[data-match-term]', { hasText: 'cartographer' })
      .click();
    await match
      .locator('[data-match-meaning]', { hasText: 'having nothing particular' })
      .click();
    await expect(match.locator('.is-wrong')).toHaveCount(2);
    await expect(match.locator('.is-wrong')).toHaveCount(0);
    await expect(match).toContainText('0 of 4');

    await reader.pickPair('cartographer', 'a person who draws');
    await expect(match).toContainText('1 of 4');
    await expect(match.locator('.is-right')).toHaveCount(2);
    await reader.pickPair('perambulate', 'to walk through');
    await expect(next).toBeHidden();
    await reader.pickPair('at loose ends', 'having nothing particular');
    await reader.pickPair('a piece of cake', 'something very easy');
    await expect(match).toContainText('4 of 4');
    await next.click();
    await page.keyboard.press('Escape');

    // The mistake makes the match count as missed: 1 of 2.
    await expect(reader.qcScreen('summary')).toContainText('1/2');
  });

  test('there is no separate Practice section under the article', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await expect(reader.quickCheck).toBeVisible();
    await expect(page.locator('.exercises, .exercise')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Practice', exact: true }),
    ).toHaveCount(0);
  });

  // Choose the form and match pairs, both clean, ending on the first drill.
  async function passChooseAndMatch(page: Page, reader: ReaderPage) {
    await reader.startQuickCheck();
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await reader.pickPair('cartographer', 'a person who draws');
    await reader.pickPair('perambulate', 'to walk through');
    await reader.pickPair('at loose ends', 'having nothing particular');
    await reader.pickPair('a piece of cake', 'something very easy');
    await reader
      .qcQuestion('match')
      .getByRole('button', { name: 'Continue' })
      .click();
  }

  test('Quick check walks every drill type and counts them in the summary', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await passChooseAndMatch(page, reader);

    // Fill the blank, typed: Check stays disabled until something is typed,
    // Enter checks and Enter again continues.
    const fill = reader.qcQuestion('type');
    await expect(fill).toContainText('3/6');
    await expect(fill).toContainText('The old cartographer would');
    await expect(
      fill.getByRole('button', { name: 'Check', exact: true }),
    ).toBeDisabled();
    await fill.locator('[data-qc-input]').fill('perambulate');
    await page.keyboard.press('Enter');
    await expect(fill.locator('[data-qc-verdict]')).toHaveText('Correct');
    await expect(fill.locator('[data-qc-note]')).toBeHidden();
    await page.keyboard.press('Enter');

    // Multiple choice reuses the choose-the-form card.
    const choose = reader.qcQuestion('choose');
    await expect(choose).toContainText('4/6');
    await expect(choose).toContainText('By the time the war ended, she had');
    await choose.locator('[data-text="drawn"]').click();
    await reader.check(choose);
    await expect(choose.locator('[data-qc-verdict]')).toHaveText('Correct');
    await choose.getByRole('button', { name: 'Continue' }).click();

    // Find the error.
    const error = reader.qcQuestion('type');
    await expect(error).toContainText('5/6');
    await expect(error).toContainText('One word is in the wrong form.');
    await error.locator('[data-qc-input]').fill('Drawn');
    await reader.check(error);
    await expect(error.locator('[data-qc-verdict]')).toHaveText('Correct');
    await error.getByRole('button', { name: 'Continue' }).click();

    // Put in order: the last question finishes on tap, no Check button.
    const order = reader.qcQuestion('order');
    await expect(order).toContainText('6/6');
    for (const word of ['the', 'boats', 'had', 'not', 'returned']) {
      await order.locator('[data-order-chip]', { hasText: word }).click();
    }
    await expect(order.locator('[data-qc-build]')).toHaveText(
      'the boats had not returned',
    );
    await expect(order.locator('[data-qc-verdict]')).toHaveText('Correct');
    await order.getByRole('button', { name: 'See results' }).click();

    const summary = reader.qcScreen('summary');
    await expect(summary).toContainText('Nice work.');
    await expect(summary).toContainText('6/6');
  });

  test('Quick check shows the right answer for a wrong drill and counts it missed', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await passChooseAndMatch(page, reader);

    // A word-bank pick fills the blank; a wrong one is flagged.
    const fill = reader.qcQuestion('type');
    await fill.locator('[data-qc-bank]', { hasText: 'wander' }).click();
    await expect(fill.locator('[data-qc-input]')).toHaveValue('wander');
    await reader.check(fill);
    await expect(fill.locator('[data-qc-verdict]')).toHaveText('Not quite');
    await expect(fill.locator('[data-qc-note]')).toHaveText(
      'Answer: perambulate',
    );
    await expect(fill.locator('[data-qc-input]')).toHaveClass(/is-wrong/);
    await fill.getByRole('button', { name: 'Continue' }).click();

    const choose = reader.qcQuestion('choose');
    await page.keyboard.press('2');
    await page.keyboard.press('Enter');
    await expect(choose.locator('[data-qc-verdict]')).toHaveText('Not quite');
    await page.keyboard.press('Enter');
    await reader.qcQuestion('type').locator('[data-qc-input]').fill('x');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    // Reset clears the taps until the sentence is complete.
    const order = reader.qcQuestion('order');
    await order.locator('[data-order-chip]', { hasText: 'had' }).click();
    await expect(order.locator('[data-qc-build]')).toHaveText('had');
    await order.getByRole('button', { name: 'Reset' }).click();
    await expect(order.locator('[data-order-chip]:disabled')).toHaveCount(0);
    for (const word of ['had', 'the', 'returned', 'boats', 'not']) {
      await order.locator('[data-order-chip]', { hasText: word }).click();
    }
    await expect(order.locator('[data-qc-verdict]')).toHaveText('Not quite');
    await expect(order.locator('[data-qc-note]')).toHaveText(
      'Answer: the boats had not returned',
    );
    await order.getByRole('button', { name: 'See results' }).click();

    // Only choose-the-form and match were right: 2 of 6.
    await expect(reader.qcScreen('summary')).toContainText('2/6');
    await expect(reader.qcScreen('summary')).toContainText('Keep at it.');
  });

  test('Quick check runs from the keyboard: 1-3 pick, Enter checks, Esc skips', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.startQuickCheck();
    const question = reader.qcScreen('question');
    // "had drawn" is option 1.
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await expect(question.locator('[data-qc-verdict]')).toHaveText('Correct');
    await expect(question.getByText('Earlier past action.')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(reader.qcQuestion('match')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(reader.qcScreen('summary')).toContainText('Nice work.');
    await expect(reader.qcScreen('summary')).toContainText('1/1');

    await page.reload();
    await reader.startQuickCheck();
    await page.keyboard.press('Escape');
    const summary = reader.qcScreen('summary');
    await expect(summary).toBeVisible();
    // Nothing was answered, so no score ring.
    await expect(summary.locator('[data-qc-ring]')).toBeHidden();
    await expect(summary).toContainText('You finished this text.');
  });

  test('Quick check can be skipped from the intro', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader
      .qcScreen('intro')
      .getByRole('button', { name: 'Skip for now' })
      .click();
    await expect(reader.qcScreen('summary')).toBeVisible();
    await expect(reader.qcScreen('intro')).toHaveCount(0);
  });

  test('a guest gets no read control and nothing is marked', async ({
    page,
  }) => {
    const marks: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/partials/mark-read')) {
        marks.push(request.url());
      }
    });
    const reader = new ReaderPage(page);
    await page.setViewportSize({ width: 1280, height: 300 });
    await reader.goto(READER_SLUG);
    await expect(reader.readState).toHaveCount(0);

    await reader.finalScreen.scrollIntoViewIfNeeded();
    await reader.studyToggle.scrollIntoViewIfNeeded();
    expect(marks).toEqual([]);
  });

  test('study mode walks the article block by block and hands over to the final screen', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await expect(reader.finalScreen).toBeVisible();

    await reader.studyToggle.click();
    await expect(reader.studyToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(reader.finalScreen).toBeHidden();
    await expect(reader.analysis.locator('.is-current')).toContainText(
      'The old cartographer',
    );
    // Grammar-free block, guest: no suggestion and no check-in.
    await expect(reader.studyPanel.locator('[data-study-word]')).toHaveCount(0);

    await reader.studyPanel.getByRole('button', { name: 'Continue' }).click();
    await expect(reader.analysis.locator('.is-current')).toContainText(
      'By the time the war ended',
    );
    await expect(
      reader.studyPanel.locator('.study-panel__checkin'),
    ).toContainText('Grammar check-in');

    await reader.studyPanel.getByRole('button', { name: 'Continue' }).click();
    await expect(reader.analysis.locator('.is-current')).toContainText(
      'Charting the last bay',
    );
    await reader.studyPanel.getByRole('button', { name: 'Finish' }).click();
    await expect(reader.studyToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(reader.studyPanel).toHaveCount(0);
    await expect(reader.finalScreen).toBeVisible();
  });

  test('"Exit study mode" leaves the article as it was', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.studyToggle.click();
    await reader.studyPanel
      .getByRole('button', { name: 'Exit study mode' })
      .click();
    await expect(reader.analysis.locator('.is-current')).toHaveCount(0);
    await expect(reader.finalScreen).toBeVisible();
  });

  test('study mode lists the other new words of a block and opens their popup', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.studyToggle.click();
    const terms = reader.studyPanel.locator('.study-panel__terms');
    await expect(terms).toContainText('cartographer');
    await expect(terms).toContainText('perambulate');
    await expect(terms).toContainText('at loose ends');

    await terms.getByRole('button', { name: 'perambulate' }).click();
    await expect(reader.popup.locator('.lex-popup__term')).toHaveText(
      'perambulate',
    );
    await expect(reader.popup).toBeVisible();
  });

  test('404s an unknown post', async ({ page }) => {
    const reader = new ReaderPage(page);
    const res = await reader.goto('nope-ZZZ00000');
    expect(res?.status()).toBe(404);
  });
});

test.describe('reader page (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('highlights learning targets; known ones are clickable but unhighlighted', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    // Seeded: word card (Review, 3 days) and phrase card (Learning) read as
    // Learning -> highlighted; "a piece of cake" has a Known disposition ->
    // still a clickable span, but unhighlighted.
    await expect(reader.wordLabel('perambulate')).toHaveCount(1);
    await expect(reader.phraseLabel('at loose ends')).toHaveCount(1);
    await expect(reader.phraseLabel('a piece of cake')).toHaveCount(0);
    await expect(reader.knownLabel('phrase', 'a piece of cake')).toHaveCount(1);

    // Grammar: the A2 point is New for this A1 user -> highlighted; the B1
    // point has a Known disposition -> unhighlighted.
    await expect(reader.grammarLabel('had drawn')).toHaveCount(1);
    await expect(reader.grammarLabel('war ended')).toHaveCount(0);
    await expect(reader.knownLabel('grammar', 'war ended')).toHaveCount(1);
  });

  test('a known phrase opens a popup with its state and no Add to deck, also from the keyboard', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const known = reader.knownLabel('phrase', 'a piece of cake');
    await known.click();
    await expect(reader.popupSection('phrase')).toContainText(
      'a piece of cake',
    );
    await expect(
      reader.popupSection('phrase').locator('.lex-state'),
    ).toHaveText('Learned');
    await expect(
      reader.popup.getByRole('button', { name: 'Add to deck' }),
    ).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(reader.popup).toBeHidden();
    await expect(known).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(reader.popupSection('phrase')).toBeVisible();
  });

  test('a known grammar match opens a popup with its state and no actions', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.knownLabel('grammar', 'war ended').first().click();
    const section = reader.popupSection('grammar');
    await expect(section.locator('.lex-state')).toBeVisible();
    await expect(
      section.getByRole('button', { name: 'Add to deck' }),
    ).toHaveCount(0);
  });

  test('grammar popup for a card-backed usage point shows its state without actions', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.grammarLabel('had drawn').click();
    const section = reader.popupSection('grammar');
    await expect(section.locator('.lex-state')).toHaveText('Learning');
    await expect(
      section.getByRole('button', { name: 'Add to deck' }),
    ).toHaveCount(0);
  });

  test('popup for a card-backed word shows its state without actions', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.wordLabel('perambulate').click();
    await expect(reader.popup.locator('.lex-state')).toHaveText('Learning');
    await expect(
      reader.popup.getByRole('button', { name: 'Add to deck' }),
    ).toHaveCount(0);
  });

  test('study mode offers the new word of a block and counts it once saved', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.studyToggle.click();
    const offer = reader.studyPanel.locator('[data-study-word]');
    // perambulate is already a card; cartographer is the New one.
    await expect(offer).toContainText('cartographer');
    await expect(offer).toContainText('a person who draws or makes maps');

    // Stubbed: saving for real would add a due card to the shared e2e user
    // and skew the specs that count them.
    const rowId = await offer.locator('.lex-actions').getAttribute('id');
    await page.route('**/partials/lexicon-action', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<div class="lex-actions" id="${rowId}"><span class="lex-state lex-state--learning" data-state="learning">Learning</span></div>`,
      }),
    );
    await offer.getByRole('button', { name: 'Add to deck' }).click();
    await expect(offer.locator('.lex-state')).toHaveText('Learning');

    await reader.studyPanel.getByRole('button', { name: 'Continue' }).click();
    await reader.studyPanel.getByRole('button', { name: 'Continue' }).click();
    await reader.studyPanel.getByRole('button', { name: 'Finish' }).click();
    await reader
      .qcScreen('intro')
      .getByRole('button', { name: 'Skip for now' })
      .click();
    await expect(reader.qcScreen('summary')).toContainText(
      'You added 1 new word to your deck.',
    );
  });

  // Stubbed: rating for real would reschedule the seeded cards that other
  // specs assert on. Returns what was posted.
  async function stubCardReview(page: Page) {
    const ratings: { cardId: string; rating: string }[] = [];
    await page.route('**/partials/card-review', (route) => {
      // The client posts multipart form data.
      const body = route.request().postData() ?? '';
      const field = (name: string) =>
        body.match(new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)`))?.[1] ??
        '';
      ratings.push({ cardId: field('cardId'), rating: field('rating') });
      return route.fulfill({ status: 204 });
    });
    return ratings;
  }

  test('Quick check recall reveals a due card, sends its rating and lowers the due count', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    const ratings = await stubCardReview(page);
    await reader.goto(READER_SLUG);
    const dueBefore = Number(
      await reader.finalScreen
        .locator('[data-qc-due]')
        .getAttribute('data-qc-due'),
    );
    const intro = reader.qcScreen('intro');
    await expect(intro).toContainText('One minute, 7 quick questions.');
    await expect(intro).toContainText('2×Choose the form');
    await expect(intro).toContainText('1×Recall a word');
    await expect(intro).toContainText('1×Match pairs');

    await reader.startQuickCheck();
    // Choose the form: "had drawn" is option 1.
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    const recall = reader.qcQuestion('recall');
    await expect(recall).toContainText('2/7');
    await expect(recall).toContainText('at loose ends');
    // The answer and the ratings stay hidden until asked for.
    await expect(recall.locator('[data-qc-answer]')).toBeHidden();
    await expect(recall.getByRole('button', { name: /Good/ })).toBeHidden();
    await page.keyboard.press('3');
    expect(ratings).toHaveLength(0);

    await page.keyboard.press(' ');
    await expect(recall.locator('[data-qc-answer]')).toContainText(
      'having nothing particular to do',
    );
    await expect(recall.locator('[data-qc-rate]')).toBeVisible();
    await page.keyboard.press('3');
    await expect.poll(() => ratings.length).toBe(1);
    expect(ratings[0].rating).toBe('good');
    expect(ratings[0].cardId).not.toBe('');

    await expect(reader.qcQuestion('match')).toBeVisible();
    await page.keyboard.press('Escape');
    const summary = reader.qcScreen('summary');
    // Choose (right) + Good: 2 of 2 answered right.
    await expect(summary).toContainText('2/2');
    // The Good card leaves today's due count.
    await expect(summary.locator('[data-qc-due]')).toHaveText(
      String(dueBefore - 1),
    );
  });

  test('Quick check recall rated Again keeps the card due', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    const ratings = await stubCardReview(page);
    await reader.goto(READER_SLUG);
    const dueBefore = await reader.finalScreen
      .locator('[data-qc-due]')
      .getAttribute('data-qc-due');

    await reader.startQuickCheck();
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    const recall = reader.qcQuestion('recall');
    await recall.getByRole('button', { name: 'Show answer' }).click();
    await recall.getByRole('button', { name: /^Again/ }).click();
    await expect.poll(() => ratings.length).toBe(1);
    expect(ratings[0].rating).toBe('again');

    await page.keyboard.press('Escape');
    const summary = reader.qcScreen('summary');
    await expect(summary).toContainText('1/2');
    await expect(summary.locator('[data-qc-due]')).toHaveText(dueBefore ?? '');
  });

  test("study mode asks each block's questions and hands the score to the summary", async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    const ratings = await stubCardReview(page);
    await reader.goto(READER_SLUG);
    const dueBefore = Number(
      await reader.finalScreen
        .locator('[data-qc-due]')
        .getAttribute('data-qc-due'),
    );
    await reader.studyToggle.click();
    await expect(reader.studyPanel).toContainText('Paragraph 1 / 3');

    // Block 1: recall of the due phrase, then the fill-in-the-blank.
    const recall = reader.studyQuestion('recall');
    await expect(recall).toContainText('at loose ends');
    await expect(recall).toContainText('1/2');
    await recall.getByRole('button', { name: 'Show answer' }).click();
    await recall.getByRole('button', { name: /^Good/ }).click();
    await expect.poll(() => ratings.length).toBe(1);
    expect(ratings[0].rating).toBe('good');

    const fill = reader.studyQuestion('type');
    await expect(fill).toContainText('2/2');
    await fill.locator('[data-qc-input]').fill('perambulate');
    await page.keyboard.press('Enter');
    await expect(fill.locator('[data-qc-verdict]')).toHaveText('Correct');
    await fill.getByRole('button', { name: 'Done' }).click();
    await expect(reader.studyPanel.locator('.study-panel__done')).toHaveText(
      'Questions done: 2/2 correct.',
    );
    await reader.studyNav.getByRole('button', { name: 'Continue' }).click();

    // Block 2: its multiple choice, find-the-error and contrastive question.
    await expect(reader.studyPanel).toContainText(
      'Paragraph 2 / 3 · 2/2 correct',
    );
    const mc = reader.studyQuestion('choose');
    await expect(mc).toContainText('she had');
    await mc.locator('[data-text="drawn"]').click();
    await reader.check(mc);
    await mc.getByRole('button', { name: 'Continue' }).click();

    const error = reader.studyQuestion('type');
    await error.locator('[data-qc-input]').fill('drawn');
    await reader.check(error);
    await error.getByRole('button', { name: 'Continue' }).click();

    const contrast = reader.studyQuestion('choose');
    await expect(contrast).toContainText('3/3');
    await contrast.locator('[data-text="drew"]').click();
    await reader.check(contrast);
    await expect(contrast.locator('[data-qc-verdict]')).toHaveText('Not quite');
    await contrast.getByRole('button', { name: 'Done' }).click();
    await expect(reader.studyPanel.locator('.study-panel__done')).toHaveText(
      'Questions done: 2/3 correct.',
    );
    await reader.studyNav.getByRole('button', { name: 'Continue' }).click();

    // Block 3: put in order.
    const order = reader.studyQuestion('order');
    for (const word of ['the', 'boats', 'had', 'not', 'returned']) {
      await order.locator('[data-order-chip]', { hasText: word }).click();
    }
    await order.getByRole('button', { name: 'Done' }).click();
    await reader.studyNav.getByRole('button', { name: 'Finish' }).click();

    // The score carries over; the Quick check card skips to its summary.
    const summary = reader.qcScreen('summary');
    await expect(summary).toContainText('Nice work.');
    await expect(summary).toContainText('5/6');
    await expect(summary.locator('[data-qc-due]')).toHaveText(
      String(dueBefore - 1),
    );
    await expect(reader.qcScreen('intro')).toHaveCount(0);
  });

  test('study mode counts only the questions that were answered', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await stubCardReview(page);
    await reader.goto(READER_SLUG);

    await reader.studyToggle.click();
    const recall = reader.studyQuestion('recall');
    await recall.getByRole('button', { name: 'Show answer' }).click();
    await recall.getByRole('button', { name: /^Again/ }).click();
    // Leave the fill-in-the-blank unanswered.
    await reader.studyNav.getByRole('button', { name: 'Continue' }).click();
    await reader.studyNav.getByRole('button', { name: 'Continue' }).click();
    await reader.studyNav.getByRole('button', { name: 'Finish' }).click();

    await expect(reader.qcScreen('summary')).toContainText('0/1');
  });

  test('the final screen links to practice only when cards from the post are due', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await reader
      .qcScreen('intro')
      .getByRole('button', { name: 'Skip for now' })
      .click();
    // The seeded word card is due and occurs in this post.
    await expect(
      reader.finalScreen.getByRole('link', {
        name: /Practice \d+ cards? from this text/,
      }),
    ).toHaveAttribute('href', '/practice');
    await expect(reader.qcScreen('summary')).toContainText('Day streak');
    await expect(reader.qcScreen('summary')).toContainText(
      'Due from this text',
    );
  });

  test("from Home, the final screen continues to today's practice", async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await page.goto(`/posts/${READER_SLUG}?from=home`);
    await reader
      .qcScreen('intro')
      .getByRole('button', { name: 'Skip for now' })
      .click();
    await expect(
      reader.finalScreen.getByRole('link', {
        name: "Continue to today's practice",
      }),
    ).toHaveAttribute('href', '/');
  });
});

test.describe('reader popup deck state (signed in, empty deck)', () => {
  // Really saves, so it runs as its own seeded user.
  test.use({ storageState: DECK_STATE });

  test('a saved word reopens as Learning without the Add action, also after reload', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const label = reader.wordLabel('cartographer');
    await label.click();
    await reader.popup.getByRole('button', { name: 'Add to deck' }).click();
    await expect(reader.popup.locator('.lex-state')).toHaveText('Learning');

    await page.keyboard.press('Escape');
    await expect(reader.popup).toBeHidden();
    await label.click();
    await expect(reader.popup.locator('.lex-state')).toHaveText('Learning');
    await expect(
      reader.popup.getByRole('button', { name: 'Add to deck' }),
    ).toHaveCount(0);

    await reader.goto(READER_SLUG);
    await reader.wordLabel('cartographer').click();
    await expect(reader.popup.locator('.lex-state')).toHaveText('Learning');
    await expect(
      reader.popup.getByRole('button', { name: 'Add to deck' }),
    ).toHaveCount(0);
  });

  test('a saved phrase reopens as Learning without the Add action, also after reload', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const label = reader.phraseLabel('at loose ends');
    await label.click();
    await reader.popup.getByRole('button', { name: 'Add to deck' }).click();
    await expect(reader.popup.locator('.lex-state')).toHaveText('Learning');

    await page.keyboard.press('Escape');
    await expect(reader.popup).toBeHidden();
    await label.click();
    await expect(reader.popup.locator('.lex-state')).toHaveText('Learning');
    await expect(
      reader.popup.getByRole('button', { name: 'Add to deck' }),
    ).toHaveCount(0);

    await reader.goto(READER_SLUG);
    await reader.phraseLabel('at loose ends').click();
    await expect(reader.popup.locator('.lex-state')).toHaveText('Learning');
    await expect(
      reader.popup.getByRole('button', { name: 'Add to deck' }),
    ).toHaveCount(0);
  });
});

test.describe('guest deck import (signed in)', () => {
  test.use({ storageState: DECK_STATE });

  test('moves the cards saved as a guest into the account', async ({
    page,
  }) => {
    // Stubbed so the deck user's data stays untouched.
    const imported = page.waitForRequest('**/partials/import-guest-deck');
    await page.route('**/partials/import-guest-deck', (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: '{"imported":1}',
      }),
    );
    const entry = {
      kind: 'word',
      id: '11111111-1111-4111-8111-111111111111',
    };
    await page.addInitScript((value) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('guest-deck', JSON.stringify([value]));
      }
    }, entry);
    await new ReaderPage(page).goto(READER_SLUG);

    const request = await imported;
    expect(request.postDataJSON()).toEqual([entry]);
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('guest-deck')))
      .toBeNull();
  });
});

test.describe('reader read state (signed in)', () => {
  // Marks and unmarks the post, so it runs as its own seeded user.
  test.use({ storageState: DECK_STATE });

  // The response, not the request: a reload straight after the request goes
  // out can render the page before the mark is committed.
  const marksRead = (page: Page) =>
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/partials/mark-read') &&
        response.request().method() === 'POST',
    );

  // Astro's CSRF check wants an Origin on a form POST, which the browser adds
  // on its own but the request fixture does not.
  const unmarkRead = (page: Page) =>
    page.request.post('/partials/unmark-read', {
      form: { slugId: READER_SLUG },
      headers: {
        origin: new URL(page.url() === 'about:blank' ? BASE_URL : page.url())
          .origin,
      },
    });

  test.beforeEach(async ({ page }) => {
    expect((await unmarkRead(page)).status()).toBe(204);
  });

  test.afterEach(async ({ page }) => {
    await unmarkRead(page);
  });

  test('the first paint does not mark, scrolling to the end does, and it can be undone', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    // A short viewport keeps the final screen below the fold.
    await page.setViewportSize({ width: 1280, height: 300 });
    let marks = 0;
    page.on('request', (request) => {
      if (request.url().endsWith('/partials/mark-read')) {
        marks += 1;
      }
    });
    await reader.goto(READER_SLUG);

    await expect(reader.readToggle).toHaveText('Mark as read');
    await expect(reader.readBadge).toBeHidden();
    await page.waitForTimeout(500);
    expect(marks).toBe(0);

    const marked = marksRead(page);
    await reader.finalScreen.scrollIntoViewIfNeeded();
    await marked;
    await expect(reader.readBadge).toBeVisible();
    await expect(reader.readToggle).toHaveText('Mark as unread');

    await page.reload();
    await expect(reader.readBadge).toBeVisible();

    await reader.readToggle.click();
    await expect(reader.readBadge).toBeHidden();
    await expect(reader.readToggle).toHaveText('Mark as read');
    await page.reload();
    await expect(reader.readBadge).toBeHidden();
  });

  test('the button marks a short post that cannot scroll, and a manual unmark is not undone by scrolling', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await expect(reader.readBadge).toBeHidden();

    await reader.readToggle.click();
    await expect(reader.readBadge).toBeVisible();
    await page.reload();
    await expect(reader.readBadge).toBeVisible();

    await reader.readToggle.click();
    await expect(reader.readBadge).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 300 });
    await reader.finalScreen.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await expect(reader.readBadge).toBeHidden();
  });

  test('finishing study mode marks the post as read', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await expect(reader.readBadge).toBeHidden();

    await reader.studyToggle.click();
    const cont = reader.studyPanel.getByRole('button', { name: 'Continue' });
    const finish = reader.studyPanel.getByRole('button', { name: 'Finish' });
    while (!(await finish.isVisible())) {
      await cont.click();
    }
    await finish.click();

    await expect(reader.readBadge).toBeVisible();
    await page.reload();
    await expect(reader.readBadge).toBeVisible();
  });
});
