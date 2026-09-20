import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { ReaderPage } from './pages/reader-page';

// Phone-width pass over every page, in both themes: nothing may push the
// document wider than the screen, and the header stays two tidy rows.

const READER_SLUG = 'the-cartographer-at-dawn-E2Eread1';

const PAGES: Array<{ name: string; path: string; authed: boolean }> = [
  { name: 'home', path: '/', authed: true },
  { name: 'guest home', path: '/', authed: false },
  { name: 'login', path: '/login', authed: false },
  {
    name: 'login code step',
    path: '/login?step=code&email=login-e2e%40engofy.test',
    authed: false,
  },
  { name: 'pricing', path: '/pricing', authed: true },
  { name: 'posts', path: '/posts', authed: true },
  { name: 'reader', path: `/posts/${READER_SLUG}`, authed: true },
  { name: 'practice', path: '/practice', authed: true },
  { name: 'dictionary', path: '/dictionary', authed: true },
  { name: 'word', path: '/dictionary/words/perambulate', authed: true },
  {
    name: 'phrase',
    path: '/dictionary/phrases/at%20loose%20ends',
    authed: true,
  },
  { name: 'grammar list', path: '/grammar', authed: true },
  { name: 'grammar page', path: '/grammar/e2e-past-perfect', authed: true },
  {
    name: 'handcrafted grammar page',
    path: '/grammar/past-present-perfect-simple',
    authed: true,
  },
  { name: 'profile', path: '/profile', authed: true },
  { name: 'progress', path: '/profile/progress', authed: true },
  { name: 'subscription', path: '/profile/subscription', authed: true },
];

for (const theme of ['light', 'dark'] as const) {
  test.describe(`phone width, ${theme} theme`, () => {
    test.use({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });

    for (const { name, path, authed } of PAGES) {
      test(`${name} fits the screen`, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: 390, height: 844 },
          hasTouch: true,
          isMobile: true,
          storageState: authed ? AUTHED_STATE : undefined,
        });
        const page = await context.newPage();
        await page.addInitScript(
          (value) => localStorage.setItem('theme', value),
          theme,
        );
        await page.goto(path);
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(
          () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        );
        expect(overflow).toBe(0);

        // All main-nav links sit on one row.
        const tops = await page
          .getByRole('navigation', { name: 'Main' })
          .getByRole('link')
          .evaluateAll((links) =>
            links.map((link) => Math.round(link.getBoundingClientRect().top)),
          );
        expect(new Set(tops).size).toBe(1);
        await context.close();
      });
    }
  });
}

test.describe('phone width, reader and practice', () => {
  test.use({
    storageState: AUTHED_STATE,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('the reader tools bar scrolls away instead of covering the text', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await expect(reader.toolbar).toBeVisible();
    await expect(reader.toolbar).toHaveCSS('position', 'static');
  });

  test('the reader tools are one swipeable row', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const tops = await reader.toolbar
      .locator('.reader-toolbar__tools > button, .reader-toolbar__step')
      .evaluateAll((buttons) =>
        buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
      );
    expect(tops.length).toBeGreaterThan(3);
    expect(new Set(tops).size).toBe(1);
    const tools = reader.toolbar.locator('.reader-toolbar__tools');
    expect(await tools.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      true,
    );
  });

  test('keyboard hints are hidden on a touch screen', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.locator('.practice__key').first()).toBeHidden();
  });

  test('the four rating buttons form a 2×2 grid', async ({ page }) => {
    await page.goto('/practice');
    await page.getByRole('button', { name: /Show answer/ }).click();
    const tops = await page
      .locator('.practice__grade')
      .evaluateAll((buttons) =>
        buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
      );
    expect(tops).toHaveLength(4);
    expect(new Set(tops).size).toBe(2);
  });
});

test.describe('phone width, guest reader', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test('the header is one row', async ({ page }) => {
    await page.goto(`/posts/${READER_SLUG}`);
    const header = await page.locator('.site-header').boundingBox();
    // Logo row only: a second nav row would push this past ~100px.
    expect(header?.height).toBeLessThan(90);
    await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
  });

  test('the first paragraph starts in the upper part of the first screen', async ({
    page,
  }) => {
    await page.goto(`/posts/${READER_SLUG}`);
    const box = await page.locator('.reading-body > *').first().boundingBox();
    expect(box?.y).toBeLessThan(844 * 0.6);
  });
});
