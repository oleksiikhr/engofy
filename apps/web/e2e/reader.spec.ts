import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';

// Slice 8b page 1 — /posts/{slug}-{id}: node-tree reading with inline analysis,
// tooltip + "+", and interactive exercises. Fixtures come from
// test/e2e/seed-web-e2e.ts (global-setup).

const READER_URL = '/posts/the-cartographer-at-dawn-E2Eread1';

test.describe('reader page (guest)', () => {
  test('renders the post with metadata and inline spans', async ({ page }) => {
    await page.goto(READER_URL);

    await expect(
      page.getByRole('heading', { name: 'The Cartographer at Dawn' }),
    ).toBeVisible();
    await expect(page.locator('.post-head .badge')).toHaveText('B1');
    await expect(
      page.getByRole('link', { name: 'https://example.com/the-cartographer' }),
    ).toBeVisible();

    await expect(page.locator('.analysis span.word')).toHaveText('perambulate');
    await expect(page.locator('.analysis span.phrase')).toHaveText(
      'at loose ends',
    );
    await expect(page.locator('.analysis span.grammar')).toHaveText(
      'had drawn',
    );
  });

  test('opens a word tooltip and prompts a guest to sign in on "+"', async ({
    page,
  }) => {
    await page.goto(READER_URL);
    await page.locator('.analysis span.word').click();

    const tip = page.locator('#analysis-tip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(
      'to walk through or around a place, especially for pleasure',
    );

    await tip.getByRole('button', { name: '+ Add word' }).click();
    await expect(tip).toContainText('Sign in to save');
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
  });

  test('404s an unknown post', async ({ page }) => {
    const res = await page.goto('/posts/nope-ZZZ00000');
    expect(res?.status()).toBe(404);
  });
});

test.describe('reader page (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('saves a word to the deck from the tooltip', async ({ page }) => {
    await page.goto(READER_URL);
    await page.locator('.analysis span.phrase').click();

    const tip = page.locator('#analysis-tip');
    await tip.getByRole('button', { name: '+ Add phrase' }).click();
    await expect(tip).toContainText('✓ Saved');
  });
});
