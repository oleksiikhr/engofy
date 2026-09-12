import { expect, type Locator, type Page } from '@playwright/test';

export class DictionaryPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly signInLink: Locator;
  readonly searchInput: Locator;
  readonly statusFilter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Your dictionary' });
    this.signInLink = page.getByRole('link', { name: 'Sign in' });
    this.searchInput = page.getByLabel('Search your dictionary');
    this.statusFilter = page.getByLabel('Filter by status');
  }

  async goto() {
    await this.page.goto('/dictionary');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL('/dictionary');
    await expect(this.heading).toBeVisible();
  }

  entryByText(text: string): Locator {
    return this.page.locator('.dict-entry', { hasText: text });
  }

  async search(text: string) {
    await this.searchInput.fill(text);
  }

  async filterByStatus(status: string) {
    await this.statusFilter.selectOption(status);
  }
}
