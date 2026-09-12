import { expect, type Locator, type Page } from '@playwright/test';

export class GrammarPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly activeChip: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Grammar reference' });
    this.activeChip = page.locator('.chip--on');
  }

  async goto(query?: string) {
    await this.page.goto(query ? `/grammar?${query}` : '/grammar');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL(/\/grammar(\?.*)?$/);
    await expect(this.heading).toBeVisible();
  }

  categoryByName(name: string): Locator {
    return this.page.locator('.grammar-cat', { hasText: name });
  }

  async filterByCefr(level: string) {
    await this.page.getByRole('link', { name: level, exact: true }).click();
  }
}
