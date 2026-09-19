import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { HomePage } from './pages/home-page';

// `/` for a signed-in user: one-shot onboarding, then the daily session.

test.describe('home (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('shows a step of the daily session', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();

    await expect(home.sessionStep).toBeVisible();
    await expect(home.onboardingHeading).toHaveCount(0);
  });

  test('the onboarding cookie shows the level prompt until it is skipped', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      {
        name: 'onboarding',
        value: '1',
        url: baseURL ?? 'http://localhost:4321',
      },
    ]);
    const home = new HomePage(page);
    await home.goto();

    await expect(home.onboardingHeading).toBeVisible();
    await expect(home.levelPills).toHaveCount(6);

    await home.skipButton.click();
    await expect(home.onboardingHeading).toHaveCount(0);
    await expect(home.sessionStep).toBeVisible();

    await page.reload();
    await expect(home.onboardingHeading).toHaveCount(0);
  });
});
