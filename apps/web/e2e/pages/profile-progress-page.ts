import { expect, type Locator, type Page } from '@playwright/test';

// /profile/progress — streak, activity calendar, CEFR bars, skills tree.
export class ProfileProgressPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly signInLink: Locator;
  readonly streakStat: Locator;
  readonly calendar: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Your progress' });
    this.signInLink = page.getByRole('link', { name: 'Sign in' });
    this.streakStat = page.locator('.stat', { hasText: 'day streak' });
    this.calendar = page.getByTestId('activity-calendar');
  }

  async goto() {
    await this.page.goto('/profile/progress');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL('/profile/progress');
    await expect(this.heading).toBeVisible();
  }

  activeDays(): Locator {
    return this.calendar.locator('[data-active="true"]');
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
