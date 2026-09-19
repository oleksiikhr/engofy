import { expect, type Locator, type Page } from '@playwright/test';

export class ReaderPage {
  readonly page: Page;
  readonly badge: Locator;
  readonly analysis: Locator;
  readonly fillBlank: Locator;
  readonly comprehension: Locator;

  constructor(page: Page) {
    this.page = page;
    this.badge = page.locator('.post-head .badge');
    this.analysis = page.locator('.analysis');
    this.fillBlank = page.locator('[data-ex-type="fill_blank"]');
    this.comprehension = page.locator('[data-ex-type="comprehension"]');
  }

  async goto(slug: string) {
    return this.page.goto(`/posts/${slug}`);
  }

  async expectLoaded(title: string) {
    await expect(this.page.getByRole('heading', { name: title })).toBeVisible();
  }

  // Spans the reader marked as new/learning targets, filtered by their text.
  wordLabel(text: string): Locator {
    return this.analysis.locator('[data-word-definition-id]', {
      hasText: text,
    });
  }

  phraseLabel(text: string): Locator {
    return this.analysis.locator('[data-phrase-id]', { hasText: text });
  }

  // Spans the reader marked as grammar usage-point matches, filtered by text.
  grammarLabel(text: string): Locator {
    return this.analysis.locator('[data-grammar-usage-point-id]', {
      hasText: text,
    });
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
