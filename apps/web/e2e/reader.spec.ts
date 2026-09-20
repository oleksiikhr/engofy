import { expect, type Page, test } from '@playwright/test';
import { AUTHED_STATE, DECK_STATE } from './auth';
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
    await reader.popup.getByRole('button', { name: 'Add to deck' }).click();
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

    await section.getByRole('button', { name: 'Add to deck' }).click();
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

    await reader.modeToggle('Word types').click();
    await expect(reader.page.locator('body')).not.toHaveClass(/reader-pos/);
    await expect(reader.page.locator('body')).toHaveClass(/reader-tense/);
  });

  test('function words stay plain until the Function words switch is on, and it is remembered', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const the = reader.token('the').first();
    const underline = () =>
      the.evaluate((el) => getComputedStyle(el).borderBottom);

    // The switch belongs to the Word types legend.
    await expect(reader.functionWordsSwitch).toBeHidden();
    await reader.modeToggle('Word types').click();
    await expect(the).toHaveAttribute('data-pos-group', 'fn');
    await expect(reader.functionWordsSwitch).not.toBeChecked();
    expect(await underline()).toMatch(/^0px/);

    await reader.functionWordsSwitch.check();
    expect(await underline()).toMatch(/^2px dotted/);
    await expect(page.locator('html')).toHaveAttribute(
      'data-function-words',
      'on',
    );

    await page.reload();
    await expect(reader.functionWordsSwitch).toBeChecked();
    expect(
      await reader
        .token('the')
        .first()
        .evaluate((el) => getComputedStyle(el).borderBottom),
    ).toMatch(/^2px dotted/);

    await reader.functionWordsSwitch.uncheck();
    expect(await underline()).toMatch(/^0px/);
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
    await expect(intro).toContainText('One minute, 2 quick questions.');
    await expect(intro).toContainText('1×Choose the form');
    await expect(intro).toContainText('1×Match pairs');
    await expect(reader.qcScreen('question')).toHaveCount(0);

    await reader.startQuickCheck();
    const question = reader.qcScreen('question');
    await expect(question).toContainText('By the time the war ended');
    await expect(question).toContainText('1/2');
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
    await expect(reader.qcQuestion('match')).toContainText('2/2');
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
    const next = match.getByRole('button', { name: 'See results' });
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

    // The mistake makes the match count as missed: 1 of 2.
    await expect(reader.qcScreen('summary')).toContainText('1/2');
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
    await expect(intro).toContainText('One minute, 3 quick questions.');
    await expect(intro).toContainText('1×Choose the form');
    await expect(intro).toContainText('1×Recall a word');
    await expect(intro).toContainText('1×Match pairs');

    await reader.startQuickCheck();
    // Choose the form: "had drawn" is option 1.
    await page.keyboard.press('1');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');

    const recall = reader.qcQuestion('recall');
    await expect(recall).toContainText('2/3');
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
