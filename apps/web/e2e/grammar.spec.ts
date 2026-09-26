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

  test('a guest gets a Start here block at A1 with the learner explanation', async ({
    page,
  }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto();
    const startHere = page.getByTestId('grammar-start-here');
    await expect(startHere).toContainText('A1');
    const card = startHere.locator('a[data-slug="e2e-present-simple"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText('routines and facts that are always true');
    // The filter form does not change it.
    await grammar.goto('cefr=C2');
    await expect(
      page
        .getByTestId('grammar-start-here')
        .locator('a[data-slug="e2e-present-simple"]'),
    ).toBeVisible();
  });

  test('a guest with a reader level cookie gets Start here at that level', async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: 'reader-level', value: 'A2', url: 'http://localhost:4321' },
    ]);
    const grammar = new GrammarPage(page);
    await grammar.goto();
    const startHere = page.getByTestId('grammar-start-here');
    await expect(startHere).toContainText('A2');
    await expect(
      startHere.locator('a[data-slug="e2e-past-perfect"]'),
    ).toBeVisible();
    await expect(
      startHere.locator('a[data-slug="e2e-present-simple"]'),
    ).toHaveCount(0);
  });

  test('hides a construction without usage points', async ({ page }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto();
    await expect(grammar.constructionLink('e2e-past-perfect')).toBeVisible();
    await expect(
      grammar.constructionLink('e2e-empty-construction'),
    ).toHaveCount(0);
  });

  test('searches constructions by name and by summary', async ({ page }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto();
    await grammar.search('perfect');
    await expect(grammar.constructionLink('e2e-past-perfect')).toBeVisible();
    await expect(grammar.constructionLink('e2e-present-simple')).toBeHidden();
    // Only the summary carries these words.
    await grammar.search('which of two past');
    await expect(grammar.constructionLink('e2e-past-perfect')).toBeVisible();
    await expect(grammar.constructionLink('e2e-conditionals')).toBeHidden();
  });

  test('search hides Start here, shows an empty note, and clears', async ({
    page,
  }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto();
    await grammar.search('zzzzqqq');
    await expect(page.getByTestId('grammar-search-empty')).toBeVisible();
    await expect(page.getByTestId('grammar-start-here')).toBeHidden();
    await grammar.search('');
    await expect(page.getByTestId('grammar-search-empty')).toBeHidden();
    await expect(page.getByTestId('grammar-start-here')).toBeVisible();
    await expect(grammar.constructionLink('e2e-past-perfect')).toBeVisible();
  });

  test('search survives a level filter swap', async ({ page }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto();
    await grammar.search('present');
    await grammar.toggleCefr('A1');
    await expect(page).toHaveURL(/\/grammar\?cefr=A1/);
    await expect(grammar.constructionLink('e2e-present-simple')).toBeVisible();
    await expect(
      grammar.constructionLink('past-present-perfect-simple'),
    ).toBeHidden();
    await expect(page.locator('#grammar-search')).toHaveValue('present');
  });

  test('a construction card shows its summary', async ({ page }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto();
    await expect(grammar.constructionLink('e2e-past-perfect')).toContainText(
      'which of two past actions happened first',
    );
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

    // The seeded user is B1. Past perfect has a card (Learning, not yet
    // graduated) on one usage point and a Known disposition on the other, so
    // it reads learning with 1/2 resolved. Present simple is A1, below their
    // level, but the CEFR default is not applied: with no activity it stays new.
    test('shows the per-construction learning state and progress', async ({
      page,
    }) => {
      const grammar = new GrammarPage(page);
      await grammar.goto();
      const pastPerfect = grammar.constructionLink('e2e-past-perfect');
      await expect(pastPerfect).toHaveAttribute('data-state', 'learning');
      await expect(pastPerfect).toContainText('1/2 learned');
      const presentSimple = grammar.constructionLink('e2e-present-simple');
      await expect(presentSimple).toHaveAttribute('data-state', 'new');
      await expect(presentSimple).toContainText('0/1 learned');
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

  test('shows the learner explanation and clean examples, and falls back to the can-do statement', async ({
    page,
  }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('e2e-past-perfect');

    const enriched = construction.usageItem(0);
    await expect(enriched).toContainText('which of two past actions');
    await expect(
      enriched.getByTestId('usage-examples').locator('li'),
    ).toHaveText([
      'She had drawn the map before he arrived.',
      'I had eaten when they called.',
    ]);
    await expect(enriched).not.toContainText('every coastline');
    await expect(enriched).not.toContainText('coming soon');

    const bare = construction.usageItem(1);
    await expect(bare).toContainText(
      'Can use the past perfect in reported speech.',
    );
    await expect(bare.getByTestId('usage-examples')).toHaveCount(0);
  });

  test('anchors a usage point at its egpIndex and lets the visitor answer its exercise pool', async ({
    page,
  }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('e2e-past-perfect');

    // The fixture's "Earlier past" point has egpIndex 90012 — the Reader
    // popup's "Practice" link targets this anchor.
    await expect(page.locator('#usage-point-90012')).toBeVisible();

    const enriched = construction.usageItem(0);
    const exercise = enriched.locator('.upe__item').first();
    await expect(exercise).toContainText('By the time he arrived');
    await exercise.locator('[data-upe-input]').fill('had drawn');
    await exercise.locator('[data-upe-check]').click();
    await expect(exercise.locator('[data-upe-feedback]')).toContainText(
      'Correct',
    );

    // The "Reported" point has no seeded pool yet — no exercises section.
    const bare = construction.usageItem(1);
    await expect(bare.locator('.upe')).toHaveCount(0);
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
    // Usage points still come from the API.
    await expect(construction.usageItems.first()).toBeVisible();
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

    test('shows per-level progress and labels an untouched below-level point as assumed known', async ({
      page,
    }) => {
      const construction = new GrammarConstructionPage(page);
      await construction.goto('e2e-present-simple');
      await expect(construction.levelProgress('A1')).toContainText(
        '0/1 learned',
      );
      await expect(construction.usageState()).toHaveText('Assumed known');
      // Still actionable: assumed known is not a settled state.
      await expect(
        construction.usageItem().getByRole('button', { name: 'I know this' }),
      ).toBeVisible();

      await construction.goto('e2e-past-perfect');
      await expect(construction.levelProgress('A2')).toContainText(
        '0/1 learned',
      );
      await expect(construction.levelProgress('B1')).toContainText(
        '1/1 learned',
      );
    });

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
