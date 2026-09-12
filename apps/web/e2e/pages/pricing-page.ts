import { expect, type Locator, type Page } from '@playwright/test';

export class PricingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly signInLink: Locator;
  readonly upgradeButton: Locator;
  readonly premiumBanner: Locator;
  readonly premiumActive: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', {
      name: 'Go further with Premium',
    });
    this.signInLink = page.getByRole('link', { name: 'Sign in to upgrade' });
    this.upgradeButton = page.getByRole('button', {
      name: 'Upgrade to Premium',
    });
    this.premiumBanner = page.getByText("You're on Premium");
    this.premiumActive = page.getByTestId('premium-active');
  }

  async goto() {
    await this.page.goto('/pricing');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL('/pricing');
    await expect(this.heading).toBeVisible();
  }
}
