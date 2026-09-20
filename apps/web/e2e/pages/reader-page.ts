import { expect, type Locator, type Page } from '@playwright/test';

export class ReaderPage {
  readonly page: Page;
  readonly badge: Locator;
  readonly analysis: Locator;
  readonly popup: Locator;
  readonly toolbar: Locator;
  readonly studyToggle: Locator;
  readonly studyPanel: Locator;
  readonly finalScreen: Locator;
  readonly quickCheck: Locator;
  readonly readState: Locator;
  readonly readToggle: Locator;
  readonly readBadge: Locator;

  constructor(page: Page) {
    this.page = page;
    this.badge = page.locator('.post-head .badge');
    this.analysis = page.locator('.analysis');
    this.popup = page.locator('.lex-popup');
    this.toolbar = page.getByRole('toolbar', { name: 'Reader tools' });
    this.studyToggle = this.toolbar.getByRole('button', {
      name: 'Study mode',
      exact: true,
    });
    this.studyPanel = page.locator('.study-panel');
    this.finalScreen = page.locator('[data-reader-final]');
    this.quickCheck = this.finalScreen.locator('[data-qc]');
    this.readState = page.locator('[data-read-state]');
    this.readToggle = this.readState.locator('[data-read-toggle]');
    this.readBadge = this.readState.locator('[data-read-badge]');
  }

  async goto(slug: string) {
    return this.page.goto(`/posts/${slug}`);
  }

  async expectLoaded(title: string) {
    await expect(this.page.getByRole('heading', { name: title })).toBeVisible();
  }

  // Highlighted spans (new/learning targets), filtered by their text.
  wordLabel(text: string): Locator {
    return this.analysis.locator(
      '[data-word-definition-id]:not([data-known])',
      { hasText: text },
    );
  }

  phraseLabel(text: string): Locator {
    return this.analysis.locator('[data-phrase-id]:not([data-known])', {
      hasText: text,
    });
  }

  // Highlighted grammar usage-point matches, filtered by text.
  grammarLabel(text: string): Locator {
    return this.analysis.locator(
      '[data-grammar-usage-point-id]:not([data-known])',
      { hasText: text },
    );
  }

  // Clickable but unhighlighted spans (learned/skipped targets) of one kind.
  knownLabel(kind: 'word' | 'phrase' | 'grammar', text: string): Locator {
    const attr = {
      word: 'data-word-definition-id',
      phrase: 'data-phrase-id',
      grammar: 'data-grammar-usage-point-id',
    }[kind];
    return this.analysis.locator(`[${attr}][data-known]`, { hasText: text });
  }

  // A token span (rendered by the server), filtered by its text.
  token(text: string): Locator {
    return this.analysis.locator('[data-tok]', {
      hasText: new RegExp(`^${text}$`),
    });
  }

  modeToggle(name: 'Word types' | 'Tenses' | 'Analyze'): Locator {
    return this.toolbar.getByRole('button', { name, exact: true });
  }

  // One section of the popup: 'word' | 'phrase' | 'grammar'.
  popupSection(kind: 'word' | 'phrase' | 'grammar'): Locator {
    return this.popup.locator(`[data-lex-kind="${kind}"]`);
  }

  // The Quick check screen currently on show: 'intro' | 'question' | 'summary'.
  qcScreen(kind: 'intro' | 'question' | 'summary'): Locator {
    return this.quickCheck.locator(`[data-qc-screen="${kind}"]:visible`);
  }

  // The question screen currently on show, by kind.
  qcQuestion(kind: 'choose' | 'recall' | 'match' | 'type' | 'order'): Locator {
    return this.quickCheck.locator(
      `[data-qc-screen="question"][data-qc-kind="${kind}"]:visible`,
    );
  }

  // Picks a word, then a meaning, on the match screen.
  async pickPair(term: string, meaning: string) {
    const screen = this.qcQuestion('match');
    await screen.locator('[data-match-term]', { hasText: term }).click();
    await screen.locator('[data-match-meaning]', { hasText: meaning }).click();
  }

  async startQuickCheck() {
    await this.quickCheck.getByRole('button', { name: 'Start' }).click();
  }

  // Clicks Check, then reads the verdict of the question on show.
  async check(question: Locator) {
    await question.getByRole('button', { name: 'Check', exact: true }).click();
  }
}
