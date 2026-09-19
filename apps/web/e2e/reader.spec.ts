import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { ReaderPage } from './pages/reader-page';

// Slice 8b page 1 — /posts/{slug}-{id}: node-tree reading. Only word/phrase
// spans whose effective state for the viewer is new/learning carry a
// `data-word-definition-id` / `data-phrase-id` label; grammar matches carry a
// `data-grammar-usage-point-id` label under the same state rule.
// Fixtures come from test/e2e/seed-web-e2e.ts (global-setup): word
// "perambulate", phrases "at loose ends" and "a piece of cake" (the seeded
// user marked it Known), grammar "past perfect" matched on "had drawn" and
// the "reported" usage point (the seeded user marked it Known) on "war ended".

const READER_SLUG = 'the-cartographer-at-dawn-E2Eread1';

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

  test('grades a fill-in-the-blank drill', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.submitFillBlank('nope');
    await expect(reader.fillBlank.locator('.exercise__result')).toHaveText(
      '✗ Try again',
    );

    await reader.submitFillBlank('perambulate');
    await expect(reader.fillBlank.locator('.exercise__result')).toHaveText(
      '✓ Correct',
    );
  });

  test('grades a fill-in-the-blank drill via the word bank', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.pickFillBlankOption('wander');
    await expect(reader.fillBlank.locator('.exercise__result')).toHaveText(
      '✗ Try again',
    );

    await reader.pickFillBlankOption('perambulate');
    await expect(reader.fillBlank.locator('.exercise__result')).toHaveText(
      '✓ Correct',
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

  test('asks a guest to sign in when saving from the popup', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.wordLabel('perambulate').click();
    await reader.popup.getByRole('button', { name: '+' }).click();
    await expect(
      reader.popup.getByRole('link', { name: 'Sign in' }),
    ).toBeVisible();
    await expect(reader.wordLabel('perambulate')).toHaveCount(1);
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
    await expect(reader.analysis).toContainText('perambulate');
  });

  test('opens a grammar popup with guideword, can-do and example', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const label = reader.grammarLabel('had drawn');
    await label.click();
    await expect(reader.popup).toBeVisible();
    const section = reader.popupSection('grammar');
    await expect(section.locator('.lex-popup__kicker')).toHaveText(
      'Grammar · past perfect',
    );
    await expect(section.locator('.lex-popup__term')).toHaveText(
      'USE: EARLIER PAST',
    );
    await expect(section.locator('.lex-popup__def')).toContainText(
      'one past action happened before another',
    );
    await expect(section.locator('.lex-popup__example')).toContainText(
      'she had drawn every coastline',
    );
    await expect(reader.popupSection('word')).toHaveCount(0);

    const popupBox = await reader.popup.boundingBox();
    const labelBox = await label.boundingBox();
    if (!popupBox || !labelBox) {
      throw new Error('popup or label has no box');
    }
    expect(popupBox.x).toBeLessThan(labelBox.x + labelBox.width);
    expect(popupBox.x + popupBox.width).toBeGreaterThan(labelBox.x);

    await section.getByRole('button', { name: '+' }).click();
    await expect(section.getByRole('link', { name: 'Sign in' })).toBeVisible();
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
      reader.popupSection('grammar').locator('.lex-popup__kicker'),
    ).toHaveText('Grammar · past perfect');
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

    await expect(reader.analysis.locator('[data-tok]')).toHaveCount(0);

    await reader.modeToggle('Parts of speech').click();
    await expect(reader.modeToggle('Parts of speech')).toHaveAttribute(
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
    // POS mode alone paints no tense colour.
    const ended = reader.token('ended');
    await expect(ended).toHaveAttribute('data-tense', 'past');
    const posOnly = await ended.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    await reader.modeToggle('Tenses').click();
    const both = await ended.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(both).not.toBe(posOnly);

    // The article's own text is untouched by the wrapping.
    await expect(reader.analysis).toContainText(
      'By the time the war ended, she had drawn every coastline twice.',
    );

    await reader.modeToggle('Parts of speech').click();
    await expect(reader.page.locator('body')).not.toHaveClass(/reader-pos/);
    await expect(reader.page.locator('body')).toHaveClass(/reader-tense/);
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

  test('the final screen asks a contrastive question and explains each option', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const question = reader.finalScreen.locator('[data-contrast-q]');
    await expect(question).toHaveCount(1);
    await expect(question).toContainText('By the time the war ended');

    await question.getByRole('button', { name: 'drew', exact: true }).click();
    await expect(question.locator('.final-q__result')).toHaveText(
      '✗ Not quite',
    );
    await expect(question.getByText('Does not show the order.')).toBeVisible();

    await question
      .getByRole('button', { name: 'had drawn', exact: true })
      .click();
    await expect(question.locator('.final-q__result')).toHaveText('✓ Correct');
    await expect(question.getByText('Earlier past action.')).toBeVisible();
    await expect(question.getByText('Does not show the order.')).toBeHidden();
  });

  test('reaching the final screen marks the post as read', async ({ page }) => {
    const reader = new ReaderPage(page);
    // This short fixture already shows the final screen on load, so the
    // request is armed before navigating.
    const marked = page.waitForRequest(
      (request) =>
        request.url().endsWith('/partials/mark-read') &&
        request.method() === 'POST',
    );
    await reader.goto(READER_SLUG);
    await marked;
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

  test('404s an unknown post', async ({ page }) => {
    const reader = new ReaderPage(page);
    const res = await reader.goto('nope-ZZZ00000');
    expect(res?.status()).toBe(404);
  });
});

test.describe('reader page (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('labels learning targets and leaves known ones as plain text', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    // Seeded: word card (Review, 3 days) and phrase card (Learning) read as
    // Learning -> labelled; "a piece of cake" has a Known disposition -> plain.
    await expect(reader.wordLabel('perambulate')).toHaveCount(1);
    await expect(reader.phraseLabel('at loose ends')).toHaveCount(1);
    await expect(reader.analysis).toContainText('a piece of cake');
    await expect(reader.phraseLabel('a piece of cake')).toHaveCount(0);

    // Grammar: the A2 point is New for this A1 user -> labelled; the B1 point
    // has a Known disposition -> plain text.
    await expect(reader.grammarLabel('had drawn')).toHaveCount(1);
    await expect(reader.analysis).toContainText('war ended');
    await expect(reader.grammarLabel('war ended')).toHaveCount(0);
  });

  test('grammar popup for a card-backed usage point shows its state without actions', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.grammarLabel('had drawn').click();
    const section = reader.popupSection('grammar');
    await expect(section.locator('.lex-state')).toHaveText('Learning');
    await expect(section.getByRole('button', { name: '+' })).toHaveCount(0);
  });

  test('popup for a card-backed word shows its state without actions', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.wordLabel('perambulate').click();
    await expect(reader.popup.locator('.lex-state')).toHaveText('Learning');
    await expect(reader.popup.getByRole('button', { name: '+' })).toHaveCount(
      0,
    );
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
    await offer.getByRole('button', { name: '+' }).click();
    await expect(offer.locator('.lex-state')).toHaveText('Learning');

    await reader.studyPanel.getByRole('button', { name: 'Continue' }).click();
    await reader.studyPanel.getByRole('button', { name: 'Continue' }).click();
    await reader.studyPanel.getByRole('button', { name: 'Finish' }).click();
    await expect(reader.finalScreen).toContainText(
      'You added 1 new word to your deck.',
    );
  });

  test('the final screen links to practice only when cards from the post are due', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    // The seeded word card is due and occurs in this post.
    await expect(
      reader.finalScreen.getByRole('link', {
        name: /Practice \d+ cards? from this text/,
      }),
    ).toHaveAttribute('href', '/practice');
  });

  test("from Home, the final screen continues to today's practice", async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await page.goto(`/posts/${READER_SLUG}?from=home`);
    await expect(
      reader.finalScreen.getByRole('link', {
        name: "Continue to today's practice",
      }),
    ).toHaveAttribute('href', '/');
  });
});
