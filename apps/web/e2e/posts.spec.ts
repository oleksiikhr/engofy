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

  test('"Show more" appends the next page', async ({ page }) => {
    const posts = new PostsPage(page);
    await posts.goto('?limit=2');
    await expect(posts.cards).toHaveCount(2);

    await posts.showMore.click();
    await expect(posts.cards.nth(2)).toBeVisible();
    expect(await posts.cards.count()).toBeGreaterThan(2);
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
