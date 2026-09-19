import { expect, type Locator, type Page } from '@playwright/test';

// /profile/subscription — plan, renewal date, card usage.
export class ProfileSubscriptionPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly signInLink: Locator;
  readonly planCard: Locator;
  readonly cardUsage: Locator;
  readonly pricingLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Subscription' });
    this.signInLink = page.getByRole('link', { name: 'Sign in' });
    this.planCard = page.getByTestId('plan-card');
    this.cardUsage = page.getByTestId('card-usage');
    this.pricingLink = page.locator('a[href="/pricing"]');
  }

  async goto() {
    await this.page.goto('/profile/subscription');
  }

  async expectLoaded() {
    await expect(this.page).toHaveURL('/profile/subscription');
    await expect(this.heading).toBeVisible();
  }
}
