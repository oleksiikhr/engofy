import type { Locator, Page } from '@playwright/test';

// `/` for a signed-in user: the onboarding prompt or one step of the daily session.
export class HomePage {
  readonly page: Page;
  readonly onboardingHeading: Locator;
  readonly levelPills: Locator;
  readonly skipButton: Locator;
  readonly sessionStep: Locator;

  constructor(page: Page) {
    this.page = page;
    this.onboardingHeading = page.getByRole('heading', {
      name: 'Set your English level',
    });
    this.levelPills = page.getByRole('radio');
    this.skipButton = page.getByRole('button', { name: 'Skip' });
    this.sessionStep = page.getByTestId(/^session-(step-|done)/);
  }

  async goto() {
    await this.page.goto('/');
  }
}
