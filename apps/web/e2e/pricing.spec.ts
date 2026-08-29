import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';

// Slice 8b page 8 — /pricing Premium description + mock checkout (PLAN §8).

test('guest is asked to sign in before upgrading', async ({ page }) => {
  await page.goto('/pricing');
  await expect(
    page.getByRole('heading', { name: 'Go further with Premium' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Sign in to upgrade' }),
  ).toBeVisible();
});

test.describe('pricing (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('mock checkout grants premium', async ({ page }) => {
    await page.goto('/pricing');

    const upgrade = page.getByRole('button', { name: 'Upgrade to Premium' });
    await expect(upgrade).toBeVisible();
    await upgrade.click();

    await expect(page.getByText("You're on Premium")).toBeVisible();
    await expect(page.getByTestId('premium-active')).toBeVisible();

    // Persists on reload.
    await page.reload();
    await expect(page.getByTestId('premium-active')).toBeVisible();
  });
});
