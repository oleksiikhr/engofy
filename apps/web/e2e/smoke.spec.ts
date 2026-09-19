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

test('the guest landing lists the features and shows the product screenshots', async ({
  page,
}) => {
  await page.goto('/');

  const features = page.getByRole('region', { name: 'Features' });
  await expect(features.getByRole('heading', { level: 2 })).toHaveCount(4);
  await expect(
    features.getByRole('heading', { name: 'Tap any word' }),
  ).toBeVisible();

  const shots = page
    .getByRole('region', { name: 'Product screenshots' })
    .getByRole('img');
  await expect(shots).toHaveCount(3);
  for (const shot of await shots.all()) {
    await shot.scrollIntoViewIfNeeded();
    await expect
      .poll(() => shot.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  }
});

test('applies the vendored body font token', async ({ page }) => {
  await page.goto('/');
  const fontFamily = await page.evaluate(
    () => getComputedStyle(document.body).fontFamily,
  );
  expect(fontFamily).toContain('Public Sans');
});
