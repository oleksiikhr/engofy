import { expect, type Locator, type Page } from '@playwright/test';

export class PostsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly searchInput: Locator;
  readonly suggestions: Locator;
  readonly unreadToggle: Locator;
  readonly cards: Locator;
  readonly showMore: Locator;
  readonly empty: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Posts', exact: true });
    this.searchInput = page.getByLabel('Search posts by word or phrase');
    this.suggestions = page.locator('#posts-suggestions option');
    this.unreadToggle = page.getByLabel('Unread only');
    this.cards = page.getByTestId('post-card');
    this.showMore = page.getByRole('link', { name: 'Show more' });
    this.empty = page.getByTestId('posts-empty');
  }

  async goto(query = '') {
    await this.page.goto(`/posts${query}`);
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  card(title: string): Locator {
    return this.cards.filter({ hasText: title });
  }

  level(level: string): Locator {
    return this.page.locator('.posts-level', { hasText: level });
  }
}
