import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';

// Slice 8b page 2 — `/` feed. PLAN.md §16/§17 Track B: the forced
// review-break card inserted every 2-3 posts (PLAN.md §4) was replaced with a
// soft "N due" badge that never interrupts the post list itself.

test.describe('feed (guest)', () => {
  test('lists published posts and links to the reader', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('heading', { name: 'Latest reading' }),
    ).toBeVisible();

    const link = page.getByRole('link', { name: 'The Cartographer at Dawn' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      'href',
      '/posts/the-cartographer-at-dawn-E2Eread1',
    );

    // No due badge for a guest — they have no queue.
    await expect(page.getByTestId('due-badge')).toHaveCount(0);
  });
});

test.describe('feed (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('shows a soft "N due" badge without breaking up the post list', async ({
    page,
  }) => {
    await page.goto('/');

    const badge = page.getByTestId('due-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText(/cards? due/);
    await expect(
      badge.getByRole('link', { name: 'start a review session' }),
    ).toHaveAttribute('href', '/practice');

    // The post list is a plain sequence of cards — no interstitial rows.
    await expect(
      page.getByRole('link', { name: 'The Cartographer at Dawn' }),
    ).toBeVisible();
  });
});
