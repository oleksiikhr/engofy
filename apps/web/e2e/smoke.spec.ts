import { expect, test } from '@playwright/test';

// Scaffold smoke check: the Astro server renders the shell and the design
// tokens load. `/` is the guest landing; the post list itself is `/posts`
// (posts.spec.ts). Assumes the full stack is running (see playwright.config).
test('renders the site shell with the guest landing', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('link', { name: 'Engofy' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Grammar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Engofy' })).toBeVisible();
});

test('applies the vendored body font token', async ({ page }) => {
  await page.goto('/');
  const fontFamily = await page.evaluate(
    () => getComputedStyle(document.body).fontFamily,
  );
  expect(fontFamily).toContain('Public Sans');
});
