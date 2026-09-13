import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { ReaderPage } from './pages/reader-page';

// Slice 8b page 1 — /posts/{slug}-{id}: node-tree reading. PLAN.md §16/§17
// Track B — inline word/phrase/grammar highlighting is gone from the article
// text; the "In this article" sidebar (grouped Grammar/Words/Phrases, with a
// known/learning/new state badge from learning_cards.state) replaces it.
// Fixtures come from test/e2e/seed-web-e2e.ts (global-setup): word
// "perambulate", phrase "at loose ends", grammar "past perfect".

const READER_SLUG = 'the-cartographer-at-dawn-E2Eread1';

test.describe('reader page (guest)', () => {
  test('renders the article body as plain prose, no inline spans', async ({
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
    await expect(reader.analysis.locator('span.word')).toHaveCount(0);
    await expect(reader.analysis.locator('span.phrase')).toHaveCount(0);
    await expect(reader.analysis.locator('span.grammar')).toHaveCount(0);
  });

  test('lists every word/phrase/construction in the sidebar as New', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const grammarGroup = reader.sidebarGroup('Grammar');
    await expect(
      grammarGroup.getByRole('link', { name: 'past perfect' }),
    ).toBeVisible();
    await expect(grammarGroup.locator('.badge--new')).toHaveText('New');

    const wordsGroup = reader.sidebarGroup('Words');
    await expect(wordsGroup).toContainText('perambulate');
    await expect(wordsGroup).toContainText(
      'to walk through or around a place, especially for pleasure',
    );
    await expect(wordsGroup.locator('.badge--new')).toHaveText('New');

    const phrasesGroup = reader.sidebarGroup('Phrases');
    await expect(phrasesGroup).toContainText('at loose ends');
    await expect(phrasesGroup.locator('.badge--new')).toHaveText('New');
  });

  test('prompts a guest to sign in when adding a sidebar word to the deck', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const wordsGroup = reader.sidebarGroup('Words');

    await reader.addToDeck(wordsGroup);
    await expect(wordsGroup).toContainText('Sign in to save');
    // HTMX swap, not a navigation.
    await expect(page).toHaveURL(`/posts/${READER_SLUG}`);
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

  test('grades comprehension questions', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.answerComprehensionQuestion(0, 'Walked around the harbour');
    await reader.answerComprehensionQuestion(1, 'Twice');
    await reader.checkComprehension();
    await expect(reader.comprehension.locator('.exercise__result')).toHaveText(
      '✓ Correct',
    );

    // A guest has no cards, so both fixture words are "new" — the summary
    // line derives straight from the sidebar's state distribution.
    await expect(reader.summary).toHaveText('+2 new words');
  });

  test('404s an unknown post', async ({ page }) => {
    const reader = new ReaderPage(page);
    const res = await reader.goto('nope-ZZZ00000');
    expect(res?.status()).toBe(404);
  });
});

test.describe('reader page (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test("reflects the user's learning_cards state in the sidebar badges", async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const wordsGroup = reader.sidebarGroup('Words');
    const phrasesGroup = reader.sidebarGroup('Phrases');
    const grammarGroup = reader.sidebarGroup('Grammar');

    // Seeded: word card state=Review, phrase card state=Learning, grammar
    // usage-point card state=Review (test/e2e/seed-web-e2e.ts).
    await expect(wordsGroup.locator('.badge')).toHaveText('Know');
    await expect(phrasesGroup.locator('.badge')).toHaveText('Learning');
    await expect(grammarGroup.locator('.badge')).toHaveText('Know');

    // Already-carded entries don't offer another "+ Add to deck".
    await expect(wordsGroup.getByRole('button')).toHaveCount(0);
    await expect(phrasesGroup.getByRole('button')).toHaveCount(0);
  });

  test('shows a completion summary after the comprehension quiz is checked', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.answerComprehensionQuestion(0, 'Walked around the harbour');
    await reader.answerComprehensionQuestion(1, 'Twice');
    await reader.checkComprehension();

    // All three fixture entries already have cards, so nothing is New/
    // Learning here — the summary line stays absent rather than reading
    // "+0 new words".
    await expect(reader.summary).toHaveCount(0);
  });
});
