import { expect, type Locator, type Page } from '@playwright/test';

export class PhraseDictionaryDetailPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly phrase: Locator;
  readonly posts: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.phrase = page.getByTestId('pd-phrase');
    this.posts = page.locator('.wd-posts');
  }

  async goto(phrase: string) {
    return this.page.goto(`/dictionary/phrases/${encodeURIComponent(phrase)}`);
  }

  async expectLoaded(phrase: string) {
    await expect(this.heading).toHaveText(phrase);
  }
}
