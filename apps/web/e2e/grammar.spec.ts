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
    // No handcrafted page for this slug — the generic render.
    await expect(construction.handcrafted).toHaveCount(0);
  });

  test('renders a handcrafted page with its compare links', async ({
    page,
  }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('past-present-perfect-simple');
    await expect(construction.handcrafted).toBeVisible();
    await expect(
      construction.handcrafted.getByRole('heading', { name: 'Form' }),
    ).toBeVisible();
    await expect(
      construction.compare.locator('a[href="/grammar/past-past-simple"]'),
    ).toBeVisible();
    // Usage points still come from the API, each with an exercise placeholder.
    await expect(construction.usageItems.first()).toBeVisible();
    await expect(construction.exercisePlaceholder()).toBeVisible();
  });

  test('derives a meta description for a generic page', async ({ page }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('e2e-past-perfect');
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute('content', /E2E: Tenses/);
    await expect(description).not.toHaveAttribute(
      'content',
      'Learn English through short authentic texts.',
    );
  });

  test('a handcrafted page sets its own meta description', async ({ page }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('past-present-perfect-simple');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /Present perfect simple in English/,
    );
  });

  test('follows a compare link', async ({ page }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('past-present-perfect-simple');
    await construction.compare
      .locator('a[href="/grammar/past-past-simple"]')
      .click();
    await expect(page).toHaveURL(/\/grammar\/past-past-simple$/);
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
      await construction.goto('e2e-conditionals');
      const item = construction.usageItem();
      await construction.addUsageToDeck();
      await expect(construction.usageState()).toHaveText('Learning');
      await expect(item.getByRole('button')).toHaveCount(0);
    });

    test('marks a usage point as known', async ({ page }) => {
      const construction = new GrammarConstructionPage(page);
      await construction.goto('e2e-conditionals');
      // The second point: the "adds a usage point" test takes the first.
      await construction.markUsageKnown(1);
      await expect(construction.usageState(1)).toHaveText('Learned');
      await expect(construction.usageItem(1).getByRole('button')).toHaveCount(
        0,
      );
    });
  });
});

test.describe('sitemap.xml', () => {
  test('lists the grammar index and every construction', async ({
    request,
  }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/xml');
    const body = await res.text();
    expect(body).toContain('<urlset');
    expect(body).toMatch(/<loc>[^<]+\/grammar<\/loc>/);
    expect(body).toMatch(/<loc>[^<]+\/grammar\/e2e-past-perfect<\/loc>/);
    expect(body).toMatch(
      /<loc>[^<]+\/grammar\/past-present-perfect-simple<\/loc>/,
    );
  });
});
