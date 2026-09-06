import { expect, test } from '@playwright/test';

// Scaffold smoke check (Slice 8b, step 0): the Astro server renders the shell,
// the design tokens load, and the feed page reaches the Nest API through the
// dev `/api` proxy. Assumes the full stack is running (see playwright.config).
test('renders the site shell with the feed', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('link', { name: 'Engofy' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Grammar' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Latest reading' }),
  ).toBeVisible();
});

test('applies the vendored body font token', async ({ page }) => {
  await page.goto('/');
  const fontFamily = await page.evaluate(
    () => getComputedStyle(document.body).fontFamily,
  );
  expect(fontFamily).toContain('Public Sans');
});
