import { expect, type Locator, type Page } from '@playwright/test';

export class FeedPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly dueBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Latest reading' });
    this.dueBadge = page.getByTestId('due-badge');
  }

  async goto() {
    return this.page.goto('/');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL('/');
    await expect(this.heading).toBeVisible();
  }

  postLink(title: string): Locator {
    return this.page.getByRole('link', { name: title });
  }
}
