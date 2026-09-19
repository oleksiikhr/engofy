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

  test('filters the queue by type through the chips', async ({ page }) => {
    const practice = new PracticePage(page);
    await practice.goto();

    // All three chips start on.
    for (const type of ['word', 'phrase', 'grammar'] as const) {
      await expect(practice.chip(type)).toHaveAttribute('aria-current', 'true');
    }

    // Deselect words and phrases -> only the grammar card is left.
    await practice.chip('word').click();
    await practice.chip('phrase').click();
    await expect(page).toHaveURL(/types=grammar/);
    await expect(practice.chip('word')).not.toHaveAttribute('aria-current');
    await expect(practice.card).toContainText(/1 card to review/);
    await expect(practice.card.locator('.practice__kicker')).not.toHaveText(
      /^(Word|Phrase)$/,
    );

    // Turning the last chip off falls back to "all".
    await practice.chip('grammar').click();
    await expect(page).toHaveURL('/practice');
  });

  // Non-destructive on purpose: the specs share one seeded queue, so this
  // never completes a grade.
  test('keyboard: space reveals the answer, digits wait for it', async ({
    page,
  }) => {
    const practice = new PracticePage(page);
    await practice.goto();
    const front = await practice.front.textContent();

    // Grading before the answer is revealed is ignored.
    await page.keyboard.press('3');
    await expect(practice.front).toHaveText(front ?? '');
    await expect(page.locator('.practice__answer')).toBeHidden();

    await page.keyboard.press('Space');
    await expect(page.locator('.practice__answer')).toBeVisible();
    await expect(practice.revealButton).toBeHidden();
  });
});
