import { expect, test } from '@playwright/test';
import { FeedPage } from './pages/feed-page';

// Scaffold smoke check: the Astro server renders the shell, the design
// tokens load, and the feed page reaches the Nest API through the dev
// `/api` proxy. Assumes the full stack is running (see playwright.config).
test('renders the site shell with the feed', async ({ page }) => {
  const feed = new FeedPage(page);
  const response = await feed.goto();
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('link', { name: 'Engofy' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Grammar' })).toBeVisible();
  await expect(feed.heading).toBeVisible();
});

test('applies the vendored body font token', async ({ page }) => {
  const feed = new FeedPage(page);
  await feed.goto();
  const fontFamily = await page.evaluate(
    () => getComputedStyle(document.body).fontFamily,
  );
  expect(fontFamily).toContain('Public Sans');
});
