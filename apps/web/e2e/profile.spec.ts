import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { ProfilePage } from './pages/profile-page';

// Slice 8b page 6 — /profile skills tree, streak, CEFR breakdown.

test('profile prompts a guest to sign in', async ({ page }) => {
  const profile = new ProfilePage(page);
  await profile.goto();
  await profile.expectLoaded();
  await expect(profile.signInLink).toBeVisible();
});

test.describe('profile (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('shows the review streak, CEFR bars and an unlocked construction', async ({
    page,
  }) => {
    const profile = new ProfilePage(page);
    await profile.goto();

    // 3 consecutive seeded review days.
    await expect(profile.streakStat).toContainText('3');

    // Seeded cards: word B1, phrase B2 (grammar A2). B1/B2 are stable across
    // the suite; A1/A2 shift as other specs add cards.
    await expect(profile.cefrCount('B1')).toContainText('1');
    await expect(profile.cefrCount('B2')).toContainText('1');

    // past perfect (the seeded E2E one) was seeded with an unlock + mastery.
    const skill = profile.skillByHref('/grammar/e2e-past-perfect');
    await expect(skill).toHaveCount(1);
    await expect(skill).not.toHaveClass(/skill--locked/);
    await expect(skill.locator('.skill__mastery')).toBeVisible();
  });
});
