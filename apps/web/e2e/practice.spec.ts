import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';

// Slice 8b page 3 — /practice SRS queue. Grading POSTs to Nest and swaps in
// the next card. The signed-in test grades a single card (it does not drain
// the queue, so other authed specs keep their due cards).

test('practice prompts a guest to sign in', async ({ page }) => {
  await page.goto('/practice');
  await expect(page.getByRole('heading', { name: 'Practice' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test.describe('practice (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('shows a due card and advances after a grade', async ({ page }) => {
    await page.goto('/practice');

    const card = page.getByTestId('practice-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText(/cards? to review/);
    // The seeded word card is the oldest due item, so it comes first.
    await expect(card.locator('.practice__front')).toHaveText('perambulate');

    await card.getByRole('button', { name: 'Good' }).click();

    // Card advanced to the next due item and dropped out of the queue.
    await expect(page.locator('.practice__front')).toHaveText('at loose ends');
  });
});
