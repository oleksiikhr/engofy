import { expect, type Locator, type Page } from '@playwright/test';

export class ReaderPage {
  readonly page: Page;
  readonly badge: Locator;
  readonly analysis: Locator;
  readonly sidebar: Locator;
  readonly summary: Locator;
  readonly fillBlank: Locator;
  readonly comprehension: Locator;

  constructor(page: Page) {
    this.page = page;
    this.badge = page.locator('.post-head .badge');
    this.analysis = page.locator('.analysis');
    this.sidebar = page.locator('.sidebar');
    this.summary = page.locator('.reader-summary');
    this.fillBlank = page.locator('[data-ex-type="fill_blank"]');
    this.comprehension = page.locator('[data-ex-type="comprehension"]');
  }

  async goto(slug: string) {
    return this.page.goto(`/posts/${slug}`);
  }

  async expectLoaded(title: string) {
    await expect(this.page.getByRole('heading', { name: title })).toBeVisible();
  }

  sidebarGroup(name: 'Grammar' | 'Words' | 'Phrases'): Locator {
    return this.sidebar.locator('.sidebar__group').filter({ hasText: name });
  }

  async addToDeck(group: Locator) {
    await group.getByRole('button', { name: '+ Add to deck' }).click();
  }

  async submitFillBlank(answer: string) {
    await this.fillBlank.locator('.exercise__blank').fill(answer);
    await this.fillBlank.getByRole('button', { name: 'Check' }).click();
  }

  async answerComprehensionQuestion(index: number, optionName: string) {
    await this.comprehension
      .locator('.exercise__cq')
      .nth(index)
      .getByRole('radio', { name: optionName })
      .check();
  }

  async checkComprehension() {
    await this.comprehension
      .getByRole('button', { name: 'Check answers' })
      .click();
  }
}
