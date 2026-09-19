import { expect, type Locator, type Page } from '@playwright/test';

export class PracticePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly signInLink: Locator;
  readonly card: Locator;
  readonly front: Locator;
  readonly revealButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Practice' });
    this.signInLink = page.getByRole('link', { name: 'Sign in' });
    this.card = page.getByTestId('practice-card');
    this.front = page.locator('.practice__front');
    this.revealButton = page.getByRole('button', { name: /Show answer/ });
  }

  async goto() {
    await this.page.goto('/practice');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL('/practice');
    await expect(this.heading).toBeVisible();
  }

  chip(type: 'word' | 'phrase' | 'grammar'): Locator {
    return this.page.getByTestId(`practice-chip-${type}`);
  }

  gradeButton(name: string): Locator {
    return this.card.getByRole('button', { name });
  }
}
