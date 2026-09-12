import { expect, type Locator, type Page } from '@playwright/test';

export class GrammarConstructionPage {
  readonly page: Page;
  readonly badge: Locator;
  readonly cheatSheet: Locator;
  readonly usageItems: Locator;

  constructor(page: Page) {
    this.page = page;
    this.badge = page.locator('.con-head .badge');
    this.cheatSheet = page.locator('.cheat');
    this.usageItems = page.locator('.usage-item');
  }

  async goto(slug: string) {
    return this.page.goto(`/grammar/${slug}`);
  }

  async expectLoaded(name: string) {
    await expect(this.page.getByRole('heading', { name })).toBeVisible();
  }

  usageItem(index = 0): Locator {
    return this.usageItems.nth(index);
  }

  async addUsageToDeck(index = 0) {
    await this.usageItem(index)
      .getByRole('button', { name: '+ Add to deck' })
      .click();
  }
}
