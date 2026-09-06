import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';

// Slice 8b page 2 — `/` feed with article -> review alternation.

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

    // No review breaks for a guest — they have no queue.
    await expect(page.getByTestId('review-break')).toHaveCount(0);
  });
});

test.describe('feed (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('interleaves a review-break card with a due term', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText(/cards? due/)).toBeVisible();

    const brk = page.getByTestId('review-break');
    await expect(brk).toHaveCount(1);
    await expect(brk).toContainText('Quick review');
    await expect(brk.getByRole('link', { name: 'Review now' })).toHaveAttribute(
      'href',
      '/practice',
    );
  });
});
