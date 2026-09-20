import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { PostsPage } from './pages/posts-page';

// posts-list-page слайд 3 — `/posts` archive: CEFR chips, word/phrase search
// with autocomplete, unread toggle (signed-in only), cursor "Show more".
// Seed (test/e2e/seed-web-e2e.ts): "The Cartographer at Dawn" (B1) is the only
// post whose sentences carry the word "perambulate" / phrase "at loose ends".

test.describe('posts (guest)', () => {
  test('lists published posts and links to the reader', async ({ page }) => {
    const posts = new PostsPage(page);
    await posts.goto();
    await posts.expectLoaded();

    const card = posts.card('The Cartographer at Dawn');
    await expect(card).toBeVisible();
    await expect(
      card.getByRole('link', { name: 'The Cartographer at Dawn' }),
    ).toHaveAttribute('href', '/posts/the-cartographer-at-dawn-E2Eread1');

    // A guest has no read state to filter on or to show on the cards.
    await expect(posts.unreadToggle).toHaveCount(0);
    await expect(card.locator('.post-card__state')).toHaveCount(0);
  });

  test('the CEFR chips narrow the list', async ({ page }) => {
    const posts = new PostsPage(page);
    await posts.goto();
    await expect(posts.card('The Cartographer at Dawn')).toBeVisible();

    await posts.level('C2').click();
    await expect(posts.empty).toBeVisible();
    await expect(page).toHaveURL(/cefr=C2/);

    await posts.level('C2').click();
    await posts.level('B1').click();
    await expect(posts.card('The Cartographer at Dawn')).toBeVisible();
    await expect(posts.cards.first().locator('.badge')).toHaveText('B1');
  });

  test('the topic chips narrow the list and cards show their topic', async ({
    page,
  }) => {
    const posts = new PostsPage(page);
    await posts.goto();
    await expect(posts.card('The Cartographer at Dawn')).toBeVisible();
    await expect(
      posts.card('The Cartographer at Dawn').getByTestId('post-topic'),
    ).toHaveText('Culture');

    await posts.topic('Food').click();
    await expect(page).toHaveURL(/topic=food/);
    await expect(posts.cards).toHaveCount(1);
    await expect(posts.card('Feed Story 2')).toBeVisible();

    await posts.topic('Culture').click();
    await expect(page).toHaveURL(/topic=food&topic=culture/);
    await expect(posts.card('The Cartographer at Dawn')).toBeVisible();
    await expect(posts.card('Feed Story 2')).toBeVisible();

    await posts.topic('Food').click();
    await posts.topic('Culture').click();
    await posts.topic('Science').click();
    await expect(posts.empty).toBeVisible();
  });

  test('a topic in the URL is applied on a fresh load', async ({ page }) => {
    const posts = new PostsPage(page);
    await posts.goto('?topic=culture');
    await expect(posts.cards).toHaveCount(1);
    await expect(posts.topic('Culture').locator('input')).toBeChecked();
  });

  test('search matches a post by its title', async ({ page }) => {
    const posts = new PostsPage(page);
    await posts.goto();
    await expect(posts.cards.nth(1)).toBeVisible();

    await posts.searchInput.fill('cartographer at');
    await posts.searchInput.press('Enter');
    await expect(posts.cards).toHaveCount(1);
    await expect(posts.card('The Cartographer at Dawn')).toBeVisible();
    await expect(page).toHaveURL(/term=cartographer(\+|%20)at/);
  });

  test('a filter in the URL is applied on a fresh load', async ({ page }) => {
    const posts = new PostsPage(page);
    await posts.goto('?cefr=C2');
    await expect(posts.empty).toBeVisible();
    await expect(posts.level('C2').locator('input')).toBeChecked();
  });

  test('search suggests words and narrows the list to matching posts', async ({
    page,
  }) => {
    const posts = new PostsPage(page);
    await posts.goto();
    await expect(posts.cards.nth(1)).toBeVisible();
    const total = await posts.cards.count();

    await posts.searchInput.fill('perambul');
    await expect(posts.suggestions.first()).toHaveAttribute(
      'value',
      'perambulate',
    );

    await posts.searchInput.fill('perambulate');
    await posts.searchInput.press('Enter');
    await expect(posts.cards).toHaveCount(1);
    await expect(posts.card('The Cartographer at Dawn')).toBeVisible();
    expect(total).toBeGreaterThan(1);
    await expect(page).toHaveURL(/term=perambulate/);
  });

  test('a chip click and Enter in search each fire one /partials/posts request', async ({
    page,
  }) => {
    const posts = new PostsPage(page);
    await posts.goto();
    await expect(posts.cards.first()).toBeVisible();

    const requests: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname === '/partials/posts') {
        requests.push(url.search);
      }
    });

    await posts.level('B1').click();
    await expect(page).toHaveURL(/cefr=B1/);
    await page.waitForLoadState('networkidle');
    expect(requests).toHaveLength(1);

    requests.length = 0;
    await posts.searchInput.fill('perambulate');
    await posts.searchInput.press('Enter');
    await expect(page).toHaveURL(/term=perambulate/);
    await page.waitForLoadState('networkidle');
    expect(requests).toHaveLength(1);
  });

  test('results keep their height while a filter request is in flight', async ({
    page,
  }) => {
    const posts = new PostsPage(page);
    await posts.goto();
    await expect(posts.cards.first()).toBeVisible();

    const results = page.locator('#posts-results');
    const before = (await results.boundingBox())?.height ?? 0;
    expect(before).toBeGreaterThan(100);

    await page.route('**/partials/posts?*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await posts.level('B1').click();

    // Sample past the old 0.2s collapse delay while the request is pending.
    await page.waitForTimeout(600);
    await expect(page.locator('#posts-filters')).toHaveClass(/htmx-request/);
    await expect(posts.cards.first()).toBeVisible();
    await expect(results).toHaveCSS('opacity', '0.5');
    const during = (await results.boundingBox())?.height ?? 0;
    expect(during).toBeGreaterThanOrEqual(before - 1);

    await expect(page).toHaveURL(/cefr=B1/);
  });

  test('"Show more" appends the next page', async ({ page }) => {
    const posts = new PostsPage(page);
    await posts.goto('?limit=2');
    await expect(posts.cards).toHaveCount(2);

    await posts.showMore.click();
    await expect(posts.cards.nth(2)).toBeVisible();
    expect(await posts.cards.count()).toBeGreaterThan(2);
  });
});

test.describe('posts (guest with a picked level)', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await context.addCookies([
      {
        name: 'reader-level',
        value: 'A1',
        url: baseURL ?? 'http://localhost:4321',
      },
    ]);
  });

  test('narrows the list to the level ±1 and says so', async ({ page }) => {
    const posts = new PostsPage(page);
    await posts.goto();

    await expect(page.getByTestId('level-hint')).toContainText('A1–A2');
    await expect(posts.card('Feed Story 2')).toBeVisible();
    await expect(posts.card('The Cartographer at Dawn')).toHaveCount(0);
    await expect(posts.level('A1').locator('input')).toBeChecked();
    await expect(posts.level('A2').locator('input')).toBeChecked();
    await expect(posts.level('B1').locator('input')).not.toBeChecked();
  });

  test('"Show all" lists every level again', async ({ page }) => {
    const posts = new PostsPage(page);
    await posts.goto();
    await page.getByRole('link', { name: 'Show all' }).click();

    await expect(page).toHaveURL(/all=1/);
    await expect(page.getByTestId('level-hint')).toHaveCount(0);
    await expect(posts.card('The Cartographer at Dawn')).toBeVisible();
    await expect(posts.level('A1').locator('input')).not.toBeChecked();
  });

  test('explicit level chips in the URL win over the cookie', async ({
    page,
  }) => {
    const posts = new PostsPage(page);
    await posts.goto('?cefr=B1');

    await expect(page.getByTestId('level-hint')).toHaveCount(0);
    await expect(posts.card('The Cartographer at Dawn')).toBeVisible();
  });

  test('changing a chip drops the hint, and clearing every chip stays on all levels after a reload', async ({
    page,
  }) => {
    const posts = new PostsPage(page);
    await posts.goto();
    await expect(page.getByTestId('level-hint')).toBeVisible();

    await posts.level('A1').click();
    await posts.level('A2').click();
    await expect(page).toHaveURL(/all=1/);
    await expect(page.getByTestId('level-hint')).toHaveCount(0);
    await expect(posts.card('The Cartographer at Dawn')).toBeVisible();

    await page.reload();
    await expect(page.getByTestId('level-hint')).toHaveCount(0);
    await expect(posts.card('The Cartographer at Dawn')).toBeVisible();
  });
});

test.describe('posts (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('shows the unread toggle', async ({ page }) => {
    const posts = new PostsPage(page);
    await posts.goto();
    await posts.expectLoaded();
    await expect(posts.unreadToggle).toBeVisible();

    await posts.unreadToggle.check();
    await expect(page).toHaveURL(/unreadOnly=true/);
    await expect(posts.unreadToggle).toBeChecked();
  });

  test('every card carries a read-state tag', async ({ page }) => {
    const posts = new PostsPage(page);
    await posts.goto();
    await expect(posts.cards.first()).toBeVisible();

    for (const card of await posts.cards.all()) {
      await expect(card.locator('.post-card__state')).toHaveText(
        /^(✓ Read|New)$/,
      );
    }
  });
});
