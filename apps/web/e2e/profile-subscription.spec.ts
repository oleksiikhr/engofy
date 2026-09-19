import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { ProfileSubscriptionPage } from './pages/profile-subscription-page';

// /profile/subscription — plan, renewal date, card usage, link to /pricing.

test('subscription prompts a guest to sign in', async ({ page }) => {
  const subscription = new ProfileSubscriptionPage(page);
  await subscription.goto();
  await subscription.expectLoaded();
  await expect(subscription.signInLink).toBeVisible();
});

test.describe('subscription (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('shows the plan, card usage and a link to pricing', async ({ page }) => {
    const subscription = new ProfileSubscriptionPage(page);
    await subscription.goto();
    await subscription.expectLoaded();

    // Free or Premium depending on whether the pricing spec already ran.
    await expect(subscription.planCard).toContainText(/Free|Premium/);
    await expect(subscription.cardUsage).toContainText(/\d+ \/ 100|unlimited/);
    await expect(subscription.pricingLink.first()).toBeVisible();
    await expect(page.getByText(/mock/i)).toHaveCount(0);
  });
});
