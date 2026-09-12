import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { PracticePage } from './pages/practice-page';

// Slice 8b page 3 — /practice SRS queue. Grading POSTs to Nest and swaps in
// the next card. The signed-in test grades a single card (it does not drain
// the queue, so other authed specs keep their due cards).

test('practice prompts a guest to sign in', async ({ page }) => {
  const practice = new PracticePage(page);
  await practice.goto();
  await practice.expectLoaded();
  await expect(practice.signInLink).toBeVisible();
});

test.describe('practice (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('shows a due card and advances after a grade', async ({ page }) => {
    const practice = new PracticePage(page);
    await practice.goto();

    await expect(practice.card).toBeVisible();
    await expect(practice.card).toContainText(/cards? to review/);
    // The seeded word card is the oldest due item, so it comes first.
    await expect(practice.front).toHaveText('perambulate');

    await practice.gradeButton('Good').click();

    // Card advanced to the next due item and dropped out of the queue.
    await expect(practice.front).toHaveText('at loose ends');
  });
});
