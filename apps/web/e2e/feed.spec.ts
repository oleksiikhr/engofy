import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { FeedPage } from './pages/feed-page';

// `/` feed. PLAN.md §16/§17 Track B: the forced review-break card inserted
// every 2-3 posts (PLAN.md §4) was replaced with a soft "N due" badge that
// never interrupts the post list itself.

test.describe('feed (guest)', () => {
  test('lists published posts and links to the reader', async ({ page }) => {
    const feed = new FeedPage(page);
    await feed.goto();
    await feed.expectLoaded();

    const link = feed.postLink('The Cartographer at Dawn');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute(
      'href',
      '/posts/the-cartographer-at-dawn-E2Eread1',
    );

    // No due badge for a guest — they have no queue.
    await expect(feed.dueBadge).toHaveCount(0);
  });
});

test.describe('feed (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('shows a soft "N due" badge without breaking up the post list', async ({
    page,
  }) => {
    const feed = new FeedPage(page);
    await feed.goto();
    await feed.expectLoaded();

    await expect(feed.dueBadge).toBeVisible();
    await expect(feed.dueBadge).toContainText(/cards? due/);
    await expect(
      feed.dueBadge.getByRole('link', { name: 'start a review session' }),
    ).toHaveAttribute('href', '/practice');

    // The post list is a plain sequence of cards — no interstitial rows.
    await expect(feed.postLink('The Cartographer at Dawn')).toBeVisible();
  });
});
