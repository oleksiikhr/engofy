import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';

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

test('the guest header hides Practice and Profile', async ({ page }) => {
  await page.goto('/');

  const nav = page.getByRole('navigation');
  await expect(nav.getByRole('link', { name: 'Today' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Posts' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Practice' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Profile' })).toHaveCount(0);
});

test.describe('signed in', () => {
  test.use({ storageState: AUTHED_STATE });

  test('the header shows Practice and Profile', async ({ page }) => {
    await page.goto('/posts');

    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: 'Practice' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Profile' })).toBeVisible();
  });
});

test('uses the system font stack and requests no webfont', async ({ page }) => {
  const fontRequests: string[] = [];
  page.on('request', (req) => {
    if (req.resourceType() === 'font') fontRequests.push(req.url());
  });
  await page.goto('/');
  const fontFamily = await page.evaluate(
    () => getComputedStyle(document.body).fontFamily,
  );
  expect(fontFamily).toContain('system-ui');
  expect(fontRequests).toEqual([]);
});
