import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';

// Scaffold smoke check: the Astro server renders the shell and the design
// tokens load. `/` is the guest landing; the post list itself is `/posts`
// (posts.spec.ts). Assumes the full stack is running (see playwright.config).
test('renders the site shell with the guest landing', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBe(200);

  await expect(page.getByRole('link', { name: 'Engofy' })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Grammar', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Learn English by reading short texts',
    }),
  ).toBeVisible();
});

test('the guest landing lists the features', async ({ page }) => {
  await page.goto('/');

  const features = page.getByRole('region', { name: 'Features' });
  await expect(features.getByRole('heading', { level: 2 })).toHaveCount(4);
  await expect(
    features.getByRole('heading', { name: 'Tap any word' }),
  ).toBeVisible();
});

test('the guest landing has one intro heading and no screenshots', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.locator('.landing-hero')).not.toContainText(
    'authentic texts',
  );
  await expect(
    page.getByRole('region', { name: 'Product screenshots' }),
  ).toHaveCount(0);
});

test('the landing lists texts for the picked level until "Show all"', async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    {
      name: 'reader-level',
      value: 'A1',
      url: baseURL ?? 'http://localhost:4321',
    },
  ]);
  await page.goto('/');

  const latest = page.getByRole('region', { name: 'Latest posts' });
  await expect(latest.getByTestId('level-hint')).toContainText('A1–A2');
  await expect(latest.locator('.latest__item .badge').first()).toHaveText(
    /A1|A2/,
  );
  await expect(latest.getByText('B1', { exact: true })).toHaveCount(0);

  await latest.getByRole('link', { name: 'Show all' }).click();
  await expect(page).toHaveURL(/all=1/);
  await expect(page.getByTestId('level-hint')).toHaveCount(0);
});

test('a word in the landing reader opens its card without API calls', async ({
  page,
}) => {
  const apiCalls: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname.startsWith('/partials') || pathname.startsWith('/api')) {
      apiCalls.push(pathname);
    }
  });
  await page.goto('/');

  const demo = page.getByRole('region', { name: 'Try the reader' });
  await demo.getByRole('button', { name: 'commutes' }).click();
  const popup = page.getByRole('dialog');
  await expect(popup).toContainText('commute');
  await expect(popup).toContainText(
    'to travel regularly between home and work',
  );
  await expect(popup.getByRole('link', { name: 'Log in' })).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Add to deck' })).toHaveCount(
    0,
  );

  await demo.getByRole('button', { name: 'catch up on' }).click();
  await expect(popup).toContainText('phrasal verb');
  await page.keyboard.press('Escape');
  await demo.getByRole('button', { name: 'She used to drive' }).click();
  await expect(popup).toContainText('Grammar');

  expect(apiCalls).toEqual([]);
  expect(
    await page.evaluate(() => localStorage.getItem('guest-deck')),
  ).toBeNull();
});

test('the guest header hides Practice and the account menu', async ({
  page,
}) => {
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Posts' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Practice' })).toHaveCount(0);
  await expect(page.getByLabel('Account menu')).toHaveCount(0);
});

test.describe('signed in', () => {
  test.use({ storageState: AUTHED_STATE });

  test('the header shows Practice and the account menu', async ({ page }) => {
    await page.goto('/posts');

    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Practice' })).toBeVisible();
    await expect(page.getByLabel('Account menu')).toBeVisible();
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
