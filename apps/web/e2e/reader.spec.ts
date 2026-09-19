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
});
