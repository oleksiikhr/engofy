import { expect, type Locator, type Page } from '@playwright/test';

export class ProfilePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly signInLink: Locator;
  readonly streakStat: Locator;
  readonly levelForm: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Your progress' });
    this.signInLink = page.getByRole('link', { name: 'Sign in' });
    this.streakStat = page.locator('.stat', { hasText: 'day streak' });
    this.levelForm = page.getByTestId('cefr-level-form');
  }

  async goto() {
    await this.page.goto('/profile');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL('/profile');
    await expect(this.heading).toBeVisible();
  }

  levelOption(level: string): Locator {
    return this.levelForm.getByRole('radio', { name: level, exact: true });
  }

  async saveLevel(level: string) {
    await this.levelOption(level).check();
    await this.levelForm.getByRole('button', { name: 'Save' }).click();
  }

  cefrCount(level: string): Locator {
    return this.page.getByTestId(`cefr-${level}`);
  }

  skillByHref(href: string): Locator {
    return this.page.locator('.skill', {
      has: this.page.locator(`a[href="${href}"]`),
    });
  }
}
