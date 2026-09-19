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

  test('grades comprehension questions', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.answerComprehensionQuestion(0, 'Walked around the harbour');
    await reader.answerComprehensionQuestion(1, 'Twice');
    await reader.checkComprehension();
    await expect(reader.comprehension.locator('.exercise__result')).toHaveText(
      '✓ Correct',
    );
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
});
