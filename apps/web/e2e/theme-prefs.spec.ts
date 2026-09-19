import { expect, type Page, test } from '@playwright/test';
import { ReaderPage } from './pages/reader-page';

// Display prefs live in localStorage and are applied to <html> by an inline
// <head> script before first paint (src/lib/prefs.ts). Each spec seeds storage
// with addInitScript, so the value is there before any page script runs.

const READER_SLUG = 'the-cartographer-at-dawn-E2Eread1';

function seed(page: Page, entries: Record<string, string>) {
  return page.addInitScript((values) => {
    for (const [key, value] of Object.entries(values)) {
      localStorage.setItem(key, value);
    }
  }, entries);
}

// Records what <html> looked like the moment <body> was inserted — i.e. before
// anything could have painted — and the page's colors at that point.
function recordFirstPaintState(page: Page) {
  return page.addInitScript(() => {
    const observer = new MutationObserver(() => {
      if (!document.body) {
        return;
      }
      observer.disconnect();
      const html = document.documentElement;
      (window as unknown as Record<string, unknown>).__firstPaint = {
        theme: html.dataset.theme ?? null,
        size: html.dataset.readerSize ?? null,
        background: getComputedStyle(document.body).backgroundColor,
      };
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

const firstPaint = (page: Page) =>
  page.evaluate(
    () =>
      (
        window as unknown as {
          __firstPaint: {
            theme: string | null;
            size: string | null;
            background: string;
          };
        }
      ).__firstPaint,
  );

const background = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('theme preference', () => {
  test('a stored dark theme is applied before first paint, even when the OS is light', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await seed(page, { theme: 'dark' });
    await recordFirstPaintState(page);
    await page.goto('/');

    const first = await firstPaint(page);
    expect(first.theme).toBe('dark');
    expect(first.background).toBe('rgb(27, 22, 17)');
    expect(await background(page)).toBe('rgb(27, 22, 17)');
  });

  test('a stored light theme wins over a dark OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await seed(page, { theme: 'light' });
    await recordFirstPaintState(page);
    await page.goto('/');

    const first = await firstPaint(page);
    expect(first.theme).toBe('light');
    expect(first.background).toBe('rgb(255, 248, 238)');
  });

  test('auto (or nothing stored) follows the OS', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    expect(await background(page)).toBe('rgb(27, 22, 17)');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);

    await page.emulateMedia({ colorScheme: 'light' });
    expect(await background(page)).toBe('rgb(255, 248, 238)');
  });

  test('an unrecognised stored value is ignored', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await seed(page, {
      theme: 'sepia',
      'reader-size': '99',
      'reader-modes': 'pos bogus',
    });
    await page.goto('/');

    const html = page.locator('html');
    await expect(html).not.toHaveAttribute('data-theme', /.*/);
    await expect(html).not.toHaveAttribute('data-reader-size', /.*/);
    await expect(html).not.toHaveAttribute('data-reader-modes', /.*/);
    expect(await background(page)).toBe('rgb(255, 248, 238)');
  });

  test('the page still renders when localStorage throws', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('link', { name: 'Engofy' })).toBeVisible();
  });

  test('stored function-words and reader-mode prefs land on <html>', async ({
    page,
  }) => {
    await seed(page, { 'function-words': 'on', 'reader-modes': 'pos analyze' });
    await page.goto('/');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-function-words', 'on');
    await expect(html).toHaveAttribute('data-reader-modes', 'pos analyze');
  });
});

test.describe('reader preferences', () => {
  test('the stored text size is applied before first paint', async ({
    page,
  }) => {
    await seed(page, { 'reader-size': '4' });
    await recordFirstPaintState(page);
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await reader.expectLoaded('The Cartographer at Dawn');

    expect((await firstPaint(page)).size).toBe('4');
    // 1.5rem at the 16px root.
    await expect(reader.analysis).toHaveCSS('font-size', '24px');
  });

  test('enabled toolbar modes are remembered across a reload', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const pos = reader.toolbar.getByRole('button', {
      name: /Word types/i,
    });
    await pos.click();
    await expect(pos).toHaveAttribute('aria-pressed', 'true');

    await page.reload();
    await expect(pos).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('body')).toHaveClass(/reader-pos/);

    await pos.click();
    await page.reload();
    await expect(pos).toHaveAttribute('aria-pressed', 'false');
  });
});
