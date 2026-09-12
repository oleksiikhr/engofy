import { expect, type Locator, type Page } from '@playwright/test';

export class PracticePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly signInLink: Locator;
  readonly card: Locator;
  readonly front: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Practice' });
    this.signInLink = page.getByRole('link', { name: 'Sign in' });
    this.card = page.getByTestId('practice-card');
    this.front = page.locator('.practice__front');
  }

  async goto() {
    await this.page.goto('/practice');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL('/practice');
    await expect(this.heading).toBeVisible();
  }

  gradeButton(name: string): Locator {
    return this.card.getByRole('button', { name });
  }
}
