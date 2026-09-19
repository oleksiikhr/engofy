import { expect, type Locator, type Page } from '@playwright/test';

export class WordDictionaryDetailPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly senses: Locator;
  readonly posts: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.senses = page.locator('.wd-sense');
    this.posts = page.locator('.wd-posts');
  }

  async goto(lemma: string) {
    return this.page.goto(`/dictionary/words/${lemma}`);
  }

  async expectLoaded(lemma: string) {
    await expect(this.heading).toHaveText(lemma);
  }

  senseByPos(pos: string): Locator {
    return this.senses.filter({
      has: this.page.locator('.badge', { hasText: pos }),
    });
  }
}
