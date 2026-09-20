import { expect, type Locator, type Page } from '@playwright/test';

export class GrammarPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly checkedLevels: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Grammar reference' });
    this.checkedLevels = page.locator('input[name="cefr"]:checked');
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

  groupByName(name: string): Locator {
    return this.page.locator('.grammar-cat', {
      has: this.page.getByRole('heading', { name, exact: true }),
    });
  }

  // The chip's checkbox is visually hidden; its <span> is what a user clicks.
  async toggleCefr(level: string) {
    await this.page
      .getByTestId('grammar-levels')
      .locator('label', { hasText: level })
      .click();
  }

  async groupBy(axis: string) {
    await this.page
      .getByTestId('grammar-group-by')
      .locator('label', { hasText: axis })
      .click();
  }

  // The dev DB also holds the real EGP data, so name-based lookups collide.
  // Scoped to the filtered list: the Start here block repeats some cards.
  constructionLink(slug: string): Locator {
    return this.page
      .locator('#grammar-results')
      .locator(`a[href="/grammar/${slug}"]`);
  }
}
