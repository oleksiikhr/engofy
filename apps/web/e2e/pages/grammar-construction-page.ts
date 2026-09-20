import { expect, type Locator, type Page } from '@playwright/test';

export class GrammarConstructionPage {
  readonly page: Page;
  readonly badge: Locator;
  readonly cheatSheet: Locator;
  readonly usageItems: Locator;
  readonly handcrafted: Locator;
  readonly compare: Locator;

  constructor(page: Page) {
    this.page = page;
    this.badge = page.locator('.con-head .badge');
    this.cheatSheet = page.locator('.cheat');
    this.usageItems = page.locator('.usage-item');
    this.handcrafted = page.locator('[data-handcrafted="true"]');
    this.compare = page.getByTestId('grammar-compare');
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

  async markUsageKnown(index = 0) {
    await this.usageItem(index)
      .getByRole('button', { name: 'I know this' })
      .click();
  }

  usageState(index = 0): Locator {
    return this.usageItem(index).locator('.gup-state');
  }

  levelProgress(level: string): Locator {
    return this.page.locator(
      `[data-testid="grammar-level-progress"] [data-level="${level}"]`,
    );
  }

  exercisePlaceholder(index = 0): Locator {
    return this.usageItem(index).getByTestId('usage-exercises');
  }
}
