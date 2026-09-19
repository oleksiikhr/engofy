import { expect, type Locator, type Page } from '@playwright/test';

export class ReaderPage {
  readonly page: Page;
  readonly badge: Locator;
  readonly analysis: Locator;
  readonly fillBlank: Locator;
  readonly popup: Locator;
  readonly toolbar: Locator;
  readonly studyToggle: Locator;
  readonly studyPanel: Locator;
  readonly finalScreen: Locator;

  constructor(page: Page) {
    this.page = page;
    this.badge = page.locator('.post-head .badge');
    this.analysis = page.locator('.analysis');
    this.fillBlank = page.locator('[data-ex-type="fill_blank"]');
    this.popup = page.locator('.lex-popup');
    this.toolbar = page.getByRole('toolbar', { name: 'Reader tools' });
    this.studyToggle = this.toolbar.getByRole('button', {
      name: 'Study mode',
      exact: true,
    });
    this.studyPanel = page.locator('.study-panel');
    this.finalScreen = page.locator('[data-reader-final]');
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

  // A token span (added once a toolbar mode is on), filtered by its text.
  token(text: string): Locator {
    return this.analysis.locator('[data-tok]', {
      hasText: new RegExp(`^${text}$`),
    });
  }

  modeToggle(name: 'Parts of speech' | 'Tenses' | 'Analyze'): Locator {
    return this.toolbar.getByRole('button', { name, exact: true });
  }

  // One section of the popup: 'word' | 'phrase' | 'grammar'.
  popupSection(kind: 'word' | 'phrase' | 'grammar'): Locator {
    return this.popup.locator(`[data-lex-kind="${kind}"]`);
  }

  async submitFillBlank(answer: string) {
    await this.fillBlank.locator('.exercise__blank').fill(answer);
    await this.fillBlank.getByRole('button', { name: 'Check' }).click();
  }

  async pickFillBlankOption(option: string) {
    await this.fillBlank
      .locator('.exercise__bank-chip', { hasText: option })
      .click();
    await this.fillBlank.getByRole('button', { name: 'Check' }).click();
  }
}
