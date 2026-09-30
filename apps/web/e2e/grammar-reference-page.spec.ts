import { expect, test } from '@playwright/test';
import { GrammarConstructionPage } from './pages/grammar-construction-page';

// Readiness checklist for the reference grammar page
// (docs/grammar-page-standard.md): the same page must pass on mobile and
// desktop, in both themes.

const SLUG = 'determiners-quantity';

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

for (const vp of viewports) {
  for (const theme of ['light', 'dark'] as const) {
    test(`the reference grammar page passes the checklist (${vp.name}, ${theme})`, async ({
      page,
    }) => {
      const problems: string[] = [];
      page.on('console', (m) => {
        if (['error', 'warning'].includes(m.type())) {
          problems.push(`console ${m.type()}: ${m.text()}`);
        }
      });
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
      page.on('response', (r) => {
        if (r.status() >= 400) {
          problems.push(`${r.status()} ${r.url()}`);
        }
      });
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.addInitScript((t) => {
        try {
          localStorage.setItem('engofy:theme', t);
        } catch {
          // storage unavailable: the OS default applies
        }
      }, theme);
      await page.emulateMedia({ colorScheme: theme });

      const construction = new GrammarConstructionPage(page);
      const res = await construction.goto(SLUG);
      await page.waitForLoadState('networkidle');

      // B1, B5
      expect(res?.status()).toBe(200);
      expect(problems).toEqual([]);
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page).toHaveTitle(
        'Determiners: quantity — Grammar — Engofy',
      );
      await expect(page.locator('meta[name="description"]')).toHaveAttribute(
        'content',
        /.+/,
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        'href',
        /\/grammar\/determiners-quantity$/,
      );
      await expect(
        page.locator('script[type="application/ld+json"]'),
      ).not.toHaveCount(0);

      // B2, B6
      await expect(construction.usageItems.first()).toBeAttached();
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      );
      expect(overflow).toBe(false);

      // B10
      const bar = await page.locator('[data-gp-progress]').boundingBox();
      expect(bar?.height).toBeLessThan(48);
    });
  }
}
