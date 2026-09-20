import { expect, type Locator, type Page } from '@playwright/test';

// The /profile hub.
export class ProfilePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly signInLink: Locator;
  readonly streakStat: Locator;
  readonly dailyPlanStatus: Locator;
  readonly planStatus: Locator;
  readonly levelForm: Locator;
  readonly goalForm: Locator;
  readonly deletionBanner: Locator;
  readonly deleteAccount: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Profile', exact: true });
    this.signInLink = page.getByRole('link', { name: 'Sign in' });
    this.streakStat = page.locator('.stat', { hasText: 'day streak' });
    this.dailyPlanStatus = page.getByTestId('daily-plan-status');
    this.planStatus = page.getByTestId('plan-status');
    this.levelForm = page.getByTestId('cefr-level-form');
    this.goalForm = page.getByTestId('daily-goal-form');
    this.deletionBanner = page.getByTestId('deletion-banner');
    this.deleteAccount = page.getByTestId('delete-account');
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

  async saveGoal(goal: number) {
    await this.goalForm.getByLabel('Cards per day').fill(String(goal));
    await this.goalForm.getByRole('button', { name: 'Save' }).click();
  }
}
