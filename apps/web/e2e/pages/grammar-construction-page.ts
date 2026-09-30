import { expect, type Locator, type Page } from '@playwright/test';

export class GrammarConstructionPage {
  readonly page: Page;
  readonly badge: Locator;
  readonly cheatSheet: Locator;
  readonly usageItems: Locator;
  readonly usageSection: Locator;
  readonly usageMore: Locator;
  readonly handcrafted: Locator;
  readonly compare: Locator;
  readonly practiceSection: Locator;

  constructor(page: Page) {
    this.page = page;
    this.badge = page.locator('.con-head .badge');
    this.cheatSheet = page.locator('#gp-section-form');
    this.usageItems = page.locator('.usage-item');
    this.usageSection = page.getByTestId('grammar-usage');
    this.usageMore = page.getByTestId('grammar-usage-more');
    this.handcrafted = page.locator('[data-handcrafted="true"]');
    this.compare = page.getByTestId('grammar-compare');
    this.practiceSection = page.locator('#gp-section-practice');
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

  async openPractice() {
    await this.practiceSection.locator('.gp-section__summary').click();
  }

  // "When it's used" starts closed; open it before interacting with a card.
  async openUsage() {
    const open = await this.usageSection.evaluate(
      (el) => (el as HTMLDetailsElement).open,
    );
    if (!open) {
      await this.usageSection.locator('.gp-section__summary').click();
    }
  }

  // Points above B1 sit inside the "More difficult cases" fold.
  async openUsageMore() {
    if ((await this.usageMore.count()) === 0) {
      return;
    }
    const open = await this.usageMore.evaluate(
      (el) => (el as HTMLDetailsElement).open,
    );
    if (!open) {
      await this.usageMore.locator('summary').click();
    }
  }

  async addUsageToDeck(index = 0) {
    await this.openUsage();
    await this.openUsageMore();
    await this.usageItem(index)
      .getByRole('button', { name: '+ Add to deck' })
      .click();
  }

  async markUsageKnown(index = 0) {
    await this.openUsage();
    await this.openUsageMore();
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
}
