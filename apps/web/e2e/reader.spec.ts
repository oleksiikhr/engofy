import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';

// Slice 8b page 1 — /posts/{slug}-{id}: node-tree reading. PLAN.md §16/§17
// Track B — inline word/phrase/grammar highlighting is gone from the article
// text; the "In this article" sidebar (grouped Grammar/Words/Phrases, with a
// known/learning/new state badge from learning_cards.state) replaces it.
// Fixtures come from test/e2e/seed-web-e2e.ts (global-setup): word
// "perambulate", phrase "at loose ends", grammar "past perfect".

const READER_URL = '/posts/the-cartographer-at-dawn-E2Eread1';

test.describe('reader page (guest)', () => {
  test('renders the article body as plain prose, no inline spans', async ({
    page,
  }) => {
    await page.goto(READER_URL);

    await expect(
      page.getByRole('heading', { name: 'The Cartographer at Dawn' }),
    ).toBeVisible();
    await expect(page.locator('.post-head .badge')).toHaveText('B1');
    await expect(
      page.getByRole('link', { name: 'https://example.com/the-cartographer' }),
    ).toBeVisible();

    await expect(page.locator('.analysis')).toContainText('perambulate');
    await expect(page.locator('.analysis span.word')).toHaveCount(0);
    await expect(page.locator('.analysis span.phrase')).toHaveCount(0);
    await expect(page.locator('.analysis span.grammar')).toHaveCount(0);
  });

  test('lists every word/phrase/construction in the sidebar as New', async ({
    page,
  }) => {
    await page.goto(READER_URL);

    const sidebar = page.locator('.sidebar');
    const grammarGroup = sidebar.locator('.sidebar__group').filter({
      hasText: 'Grammar',
    });
    await expect(
      grammarGroup.getByRole('link', { name: 'past perfect' }),
    ).toBeVisible();
    await expect(grammarGroup.locator('.badge--new')).toHaveText('New');

    const wordsGroup = sidebar.locator('.sidebar__group').filter({
      hasText: 'Words',
    });
    await expect(wordsGroup).toContainText('perambulate');
    await expect(wordsGroup).toContainText(
      'to walk through or around a place, especially for pleasure',
    );
    await expect(wordsGroup.locator('.badge--new')).toHaveText('New');

    const phrasesGroup = sidebar.locator('.sidebar__group').filter({
      hasText: 'Phrases',
    });
    await expect(phrasesGroup).toContainText('at loose ends');
    await expect(phrasesGroup.locator('.badge--new')).toHaveText('New');
  });

  test('prompts a guest to sign in when adding a sidebar word to the deck', async ({
    page,
  }) => {
    await page.goto(READER_URL);
    const wordsGroup = page.locator('.sidebar__group').filter({
      hasText: 'Words',
    });

    await wordsGroup.getByRole('button', { name: '+ Add to deck' }).click();
    await expect(wordsGroup).toContainText('Sign in to save');
    // HTMX swap, not a navigation.
    await expect(page).toHaveURL(READER_URL);
  });

  test('grades a fill-in-the-blank drill', async ({ page }) => {
    await page.goto(READER_URL);
    const drill = page.locator('[data-ex-type="fill_blank"]');

    await drill.locator('.exercise__blank').fill('nope');
    await drill.getByRole('button', { name: 'Check' }).click();
    await expect(drill.locator('.exercise__result')).toHaveText('✗ Try again');

    await drill.locator('.exercise__blank').fill('perambulate');
    await drill.getByRole('button', { name: 'Check' }).click();
    await expect(drill.locator('.exercise__result')).toHaveText('✓ Correct');
  });

  test('grades comprehension questions', async ({ page }) => {
    await page.goto(READER_URL);
    const box = page.locator('[data-ex-type="comprehension"]');

    await box
      .locator('.exercise__cq')
      .nth(0)
      .getByRole('radio', { name: 'Walked around the harbour' })
      .check();
    await box
      .locator('.exercise__cq')
      .nth(1)
      .getByRole('radio', { name: 'Twice' })
      .check();
    await box.getByRole('button', { name: 'Check answers' }).click();
    await expect(box.locator('.exercise__result')).toHaveText('✓ Correct');

    // A guest has no cards, so both fixture words are "new" — the summary
    // line derives straight from the sidebar's state distribution.
    await expect(page.locator('.reader-summary')).toHaveText('+2 new words');
  });

  test('404s an unknown post', async ({ page }) => {
    const res = await page.goto('/posts/nope-ZZZ00000');
    expect(res?.status()).toBe(404);
  });
});

test.describe('reader page (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test("reflects the user's learning_cards state in the sidebar badges", async ({
    page,
  }) => {
    await page.goto(READER_URL);

    const sidebar = page.locator('.sidebar');
    const wordsGroup = sidebar.locator('.sidebar__group').filter({
      hasText: 'Words',
    });
    const phrasesGroup = sidebar.locator('.sidebar__group').filter({
      hasText: 'Phrases',
    });
    const grammarGroup = sidebar.locator('.sidebar__group').filter({
      hasText: 'Grammar',
    });

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
    await page.goto(READER_URL);
    const box = page.locator('[data-ex-type="comprehension"]');

    await box
      .locator('.exercise__cq')
      .nth(0)
      .getByRole('radio', { name: 'Walked around the harbour' })
      .check();
    await box
      .locator('.exercise__cq')
      .nth(1)
      .getByRole('radio', { name: 'Twice' })
      .check();
    await box.getByRole('button', { name: 'Check answers' }).click();

    // All three fixture entries already have cards, so nothing is New/
    // Learning here — the summary line stays absent rather than reading
    // "+0 new words".
    await expect(page.locator('.reader-summary')).toHaveCount(0);
  });
});
