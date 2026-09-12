import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { PricingPage } from './pages/pricing-page';

// Slice 8b page 8 — /pricing Premium description + mock checkout (PLAN §8).

test('guest is asked to sign in before upgrading', async ({ page }) => {
  const pricing = new PricingPage(page);
  await pricing.goto();
  await pricing.expectLoaded();
  await expect(pricing.signInLink).toBeVisible();
});

test.describe('pricing (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('mock checkout grants premium', async ({ page }) => {
    const pricing = new PricingPage(page);
    await pricing.goto();

    await expect(pricing.upgradeButton).toBeVisible();
    await pricing.upgradeButton.click();

    await expect(pricing.premiumBanner).toBeVisible();
    await expect(pricing.premiumActive).toBeVisible();

    // Persists on reload.
    await page.reload();
    await expect(pricing.premiumActive).toBeVisible();
  });
});
