import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { GrammarConstructionPage } from './pages/grammar-construction-page';
import { GrammarPage } from './pages/grammar-page';

// Slice 8b page 4 — /grammar reference (19 -> 90, CEFR filter) and
// /grammar/{slug} construction detail.

test.describe('grammar reference', () => {
  test('lists categories and constructions', async ({ page }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto();
    await grammar.expectLoaded();

    const cat = grammar.categoryByName('E2E: Tenses');
    await expect(cat.getByRole('link', { name: /past perfect/ })).toBeVisible();
    await expect(
      cat.getByRole('link', { name: /present simple/ }),
    ).toBeVisible();
  });

  test('filters by CEFR level (SSR)', async ({ page }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto('cefr=A1');
    const cat = grammar.categoryByName('E2E: Tenses');
    await expect(
      cat.getByRole('link', { name: /present simple/ }),
    ).toBeVisible();
    await expect(cat.getByRole('link', { name: /past perfect/ })).toHaveCount(
      0,
    );
  });

  test('filters by CEFR level (HTMX chip)', async ({ page }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto();
    await grammar.toggleCefr('A1');
    await expect(page).toHaveURL(/\/grammar\?cefr=A1/);
    const cat = grammar.categoryByName('E2E: Tenses');
    await expect(cat.getByRole('link', { name: /past perfect/ })).toHaveCount(
      0,
    );
    await expect(grammar.checkedLevels).toHaveCount(1);
  });

  test('multi-selects CEFR levels', async ({ page }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto('cefr=A1&cefr=A2');
    await expect(grammar.checkedLevels).toHaveCount(2);
    const cat = grammar.categoryByName('E2E: Tenses');
    await expect(cat.getByRole('link', { name: /past perfect/ })).toBeVisible();
    await expect(
      cat.getByRole('link', { name: /present simple/ }),
    ).toBeVisible();
  });

  test('groups by CEFR level and by time block', async ({ page }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto();
    await grammar.groupBy('Level');
    await expect(page).toHaveURL(/groupBy=cefr/);
    await expect(
      grammar
        .groupByName('A1')
        .locator('a[href="/grammar/e2e-present-simple"]'),
    ).toBeVisible();
    await expect(
      grammar.groupByName('A2').locator('a[href="/grammar/e2e-past-perfect"]'),
    ).toBeVisible();

    await grammar.groupBy('Time');
    await expect(page).toHaveURL(/groupBy=time/);
    // The seeded category is off the tense axis.
    await expect(
      grammar
        .groupByName('Other')
        .locator('a[href="/grammar/e2e-past-perfect"]'),
    ).toBeVisible();
  });

  test('a guest sees every construction as new', async ({ page }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto();
    await expect(grammar.constructionLink('e2e-past-perfect')).toHaveAttribute(
      'data-state',
      'new',
    );
  });

  test.describe('signed in', () => {
    test.use({ storageState: AUTHED_STATE });

    // The seeded user is B1: past perfect has a card (Learning); present
    // simple is A1, below their level, so it reads as already known.
    test('shows the per-construction learning state', async ({ page }) => {
      const grammar = new GrammarPage(page);
      await grammar.goto();
      await expect(
        grammar.constructionLink('e2e-past-perfect'),
      ).toHaveAttribute('data-state', 'learning');
      await expect(
        grammar.constructionLink('e2e-present-simple'),
      ).toHaveAttribute('data-state', 'learned');
    });
  });

  test('404s an unknown construction', async ({ page }) => {
    const construction = new GrammarConstructionPage(page);
    const res = await construction.goto('no-such-construction');
    expect(res?.status()).toBe(404);
  });
});

test.describe('grammar construction detail', () => {
  test('shows the cheat sheet and usage points', async ({ page }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('e2e-past-perfect');
    await construction.expectLoaded('past perfect');

    await expect(construction.badge).toHaveText('A2');
    await expect(construction.cheatSheet).toContainText('Form');
    await expect(construction.usageItems).toHaveCount(2);
  });

  test('guest gets a sign-in prompt from "+"', async ({ page }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('e2e-past-perfect');
    await construction.addUsageToDeck();
    await expect(construction.usageItem()).toContainText('Sign in to save');
  });

  test.describe('signed in', () => {
    test.use({ storageState: AUTHED_STATE });

    test('adds a usage point to the deck', async ({ page }) => {
      const construction = new GrammarConstructionPage(page);
      await construction.goto('e2e-present-simple');
      const item = construction.usageItem();
      await construction.addUsageToDeck();
      await expect(item).toContainText('✓ Saved');
    });
  });
});
