import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { blockScripts } from './block-scripts';
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

  test('badges a construction with a handcrafted page, not a generic one', async ({
    page,
  }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto();
    await expect(
      grammar
        .constructionLink('past-present-perfect-simple')
        .getByText('Guide'),
    ).toBeVisible();
    await expect(
      grammar.constructionLink('e2e-past-perfect').getByText('Guide'),
    ).toHaveCount(0);
  });

  test('a guest gets no "Continue learning" CTA', async ({ page }) => {
    const grammar = new GrammarPage(page);
    await grammar.goto();
    await expect(page.getByTestId('grammar-continue')).toHaveCount(0);
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

    test('offers to continue the construction in progress', async ({
      page,
    }) => {
      const grammar = new GrammarPage(page);
      await grammar.goto();
      const cta = page.getByTestId('grammar-continue');
      await expect(cta).toHaveAttribute('href', '/grammar/e2e-past-perfect');
      await expect(cta).toContainText('past perfect');
      await expect(cta).toContainText('1/2 learned');
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

  test('names the construction with its category in H1 and title, level badge outside the H1', async ({
    page,
  }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('adjectives-position');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Adjectives: position',
    );
    await expect(page).toHaveTitle('Adjectives: position — Grammar — Engofy');
    await expect(page.locator('h1 .badge')).toHaveCount(0);
    await construction.goto('past-past-simple');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Past simple',
    );
  });

  test('keeps the sticky progress a thin bar; the section list overlays on demand', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const construction = new GrammarConstructionPage(page);
    await construction.goto('past-present-perfect-simple');
    const bar = page.locator('[data-gp-progress]');
    const list = page.locator('.gp-progress__list');
    expect((await bar.boundingBox())?.height).toBeLessThan(48);
    await expect(list).toBeHidden();

    const below = page.locator('.con-body');
    const before = (await below.boundingBox())?.y;
    await page.locator('[data-gp-progress-more] summary').click();
    await expect(list).toBeVisible();
    expect((await below.boundingBox())?.y).toBe(before);

    // The bar names the section being read.
    await list.locator('a').last().click();
    await expect(list).toBeHidden();
    await expect(page.locator('[data-gp-progress-current]')).toHaveText(
      'Practice',
    );
  });

  test('keeps "When it\'s used" closed until opened, with a rule count', async ({
    page,
  }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('e2e-past-perfect');

    await expect(construction.usageSection).not.toHaveAttribute('open');
    await expect(construction.usageSection).toContainText('2 rules');
    await expect(construction.usageItem(0)).toBeHidden();
    // Two points fit under the visible limit — no "Show more" toggle.
    await expect(construction.usageMore).toHaveCount(0);

    const checklistItem = page.locator('[data-gp-progress-item="use"]');
    await page.locator('[data-gp-progress-more] summary').click();
    await expect(checklistItem).toHaveAttribute('data-done', 'false');
    await checklistItem.click();
    await expect(construction.usageSection).toHaveAttribute('open');
    await expect(checklistItem).toHaveAttribute('data-done', 'true');
    await expect(construction.usageItem(1)).toBeVisible();
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
    ).toContainText([
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

  test('switches a translated explanation to Ukrainian and remembers it', async ({
    page,
  }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('e2e-past-perfect');
    await construction.openUsage();

    const translated = construction.usageItem(0);
    const english = translated.getByText('which of two past actions');
    const ukrainian = translated.getByText('яка з двох минулих дій');
    const example = translated.getByText('She had drawn the map');
    const exampleUk = translated.getByText('Вона намалювала мапу');
    const uk = translated.getByRole('button', { name: 'УКР' });
    await expect(english).toBeVisible();
    await expect(ukrainian).toBeHidden();
    await expect(exampleUk).toBeHidden();
    await expect(uk).toHaveAttribute('aria-pressed', 'false');

    await uk.click();
    await expect(ukrainian).toBeVisible();
    await expect(english).toBeHidden();
    // The English example stays; its translation appears under it.
    await expect(example).toBeVisible();
    await expect(exampleUk).toBeVisible();
    await expect(uk).toHaveAttribute('aria-pressed', 'true');
    // No translation — no switch, English only.
    await expect(
      construction.usageItem(1).locator('[data-usage-lang]'),
    ).toHaveCount(0);

    await page.reload();
    await construction.openUsage();
    await expect(ukrainian).toBeVisible();
    await expect(uk).toHaveAttribute('aria-pressed', 'true');
    await translated.getByRole('button', { name: 'EN' }).click();
    await expect(english).toBeVisible();
  });

  test('ignores a stored language value it does not know', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('popup-lang', 'uk');
    });
    const construction = new GrammarConstructionPage(page);
    await construction.goto('e2e-past-perfect');
    await construction.openUsage();

    const translated = construction.usageItem(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-popup-lang');
    await expect(
      translated.getByText('which of two past actions'),
    ).toBeVisible();
    await expect(
      translated.getByRole('button', { name: 'EN' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  // The stored language is applied before first paint (boot script), so the
  // card below the translated one sits where it will once scripts have run.
  for (const [name, viewport] of [
    ['desktop', { width: 1100, height: 700 }],
    ['phone', { width: 390, height: 844 }],
  ] as const) {
    test(`a stored Ukrainian choice does not shift the cards when scripts run (${name})`, async ({
      browser,
    }) => {
      const nextCardY = async (scripts: boolean) => {
        const context = await browser.newContext({ viewport });
        await context.addInitScript(() => {
          localStorage.setItem('popup-lang', 'native');
        });
        const page = await context.newPage();
        if (!scripts) {
          await blockScripts(page);
        }
        const construction = new GrammarConstructionPage(page);
        await construction.goto('e2e-past-perfect');
        await construction.openUsage();
        await expect(
          construction.usageItem(0).getByText('яка з двох минулих дій'),
        ).toBeVisible();
        await expect(
          construction.usageItem(0).getByText('Вона намалювала мапу'),
        ).toBeVisible();
        const box = await construction.usageItem(1).boundingBox();
        await context.close();
        return box?.y;
      };
      const beforeScripts = await nextCardY(false);
      const afterScripts = await nextCardY(true);
      expect(beforeScripts).toBeDefined();
      expect(beforeScripts).toBeCloseTo(afterScripts ?? -1, 0);
    });
  }

  test('anchors a usage point at its egpIndex and lets the visitor answer its exercise pool', async ({
    page,
  }) => {
    // The fixture's "Earlier past" point has egpIndex 90012 — the Reader
    // popup's "Practice" link targets this anchor, which opens the closed
    // "When it's used" section.
    await page.goto('/grammar/e2e-past-perfect#usage-point-90012');
    const construction = new GrammarConstructionPage(page);
    await expect(page.locator('#usage-point-90012')).toBeVisible();

    // The card links to its group in Practice, which holds the exercises.
    const enriched = construction.usageItem(0);
    await expect(enriched.locator('.upe')).toHaveCount(0);
    await enriched.getByRole('link', { name: 'Practice · 1' }).click();
    const group = page.locator('#practice-90012');
    await expect(group).toBeVisible();
    const exercise = group.locator('.upe__item').first();
    await expect(exercise).toContainText('By the time he arrived');
    await exercise.locator('[data-upe-input]').fill('had drawn');
    await exercise.locator('[data-upe-check]').click();
    await expect(exercise.locator('[data-upe-feedback]')).toContainText(
      'Correct',
    );

    // The "Reported" point has no seeded pool yet — no Practice link.
    const bare = construction.usageItem(1);
    await expect(bare.getByRole('link', { name: /Practice/ })).toHaveCount(0);
  });

  test("gathers the page's exercises in Practice and checks an answer", async ({
    page,
  }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('e2e-past-perfect');
    await construction.openPractice();

    const exercise = page
      .getByTestId('page-practice')
      .locator('.upe__item')
      .first();
    await expect(exercise).toContainText('By the time he arrived');
    // The ____ blank splits the prompt: the input sits inside the sentence.
    await expect(exercise.locator('.qc__prompt [data-upe-input]')).toHaveCount(
      1,
    );
    await exercise.locator('[data-upe-input]').fill('had drawn');
    await exercise.locator('[data-upe-check]').click();
    await expect(exercise.locator('[data-upe-feedback]')).toContainText(
      'Correct',
    );
  });

  test('keeps the Practice placeholder on a page with no exercises', async ({
    page,
  }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('e2e-present-simple');
    await construction.openPractice();

    await expect(construction.practiceSection).toContainText('on the way');
    await expect(page.getByTestId('page-practice')).toHaveCount(0);
  });

  test('a word on a handcrafted page opens the dictionary popup', async ({
    page,
  }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('past-present-perfect-simple');

    const word = construction.handcrafted
      .locator('[data-word-definition-id]', { hasText: 'lost' })
      .first();
    await word.click();
    const popup = page.locator('.lex-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('To be unable to find something.');
    // No post behind a grammar page — nothing to report against.
    await expect(
      popup.getByRole('button', { name: 'Report a mistake' }),
    ).toHaveCount(0);
  });

  test('a phrase on a handcrafted page opens its own popup', async ({
    page,
  }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('past-present-perfect-simple');

    const phrase = construction.handcrafted
      .locator('[data-phrase-id]', { hasText: 'so far' })
      .first();
    // Its section starts closed.
    await phrase.evaluate((el) => {
      const section = el.closest('details');
      if (section) {
        section.open = true;
      }
    });
    await phrase.click();
    await expect(page.locator('.lex-popup')).toContainText('Until now.');
  });

  // The words are wrapped on the server, so they are there before first
  // paint and the text below them doesn't move when scripts run.
  test('clickable words do not shift the page when scripts run', async ({
    browser,
  }) => {
    const compareY = async (scripts: boolean) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      if (!scripts) {
        await blockScripts(page);
      }
      const construction = new GrammarConstructionPage(page);
      await construction.goto('past-present-perfect-simple');
      await expect(
        construction.handcrafted.locator('[data-word-definition-id]').first(),
      ).toBeAttached();
      const box = await construction.compare.boundingBox();
      await context.close();
      return box?.y;
    };
    const beforeScripts = await compareY(false);
    const afterScripts = await compareY(true);
    expect(beforeScripts).toBeDefined();
    expect(beforeScripts).toBeCloseTo(afterScripts ?? -1, 0);
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
    await construction.openUsage();
    await expect(construction.usageItems.first()).toBeVisible();
  });

  test('derives a meta description for a generic page', async ({ page }) => {
    const construction = new GrammarConstructionPage(page);
    await construction.goto('e2e-past-perfect');
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveAttribute(
      'content',
      /past perfect \(A2\) in English grammar/,
    );
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
      await construction.openUsage();
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
