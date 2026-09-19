import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { ProfileProgressPage } from './pages/profile-progress-page';

// /profile/progress — skills tree, streak, activity calendar, CEFR breakdown.

test('progress prompts a guest to sign in', async ({ page }) => {
  const progress = new ProfileProgressPage(page);
  await progress.goto();
  await progress.expectLoaded();
  await expect(progress.signInLink).toBeVisible();
});

test.describe('progress (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('shows the review streak, CEFR bars and an unlocked construction', async ({
    page,
  }) => {
    const progress = new ProfileProgressPage(page);
    await progress.goto();
    await progress.expectLoaded();

    // 3 consecutive seeded review days.
    await expect(progress.streakStat).toContainText('3');

    // Seeded cards: word B1, phrase B2 (grammar A2). B1/B2 are stable across
    // the suite; A1/A2 shift as other specs add cards.
    await expect(progress.cefrCount('B1')).toContainText('1');
    await expect(progress.cefrCount('B2')).toContainText('1');

    // past perfect (the seeded E2E one) was seeded with an unlock + mastery.
    const skill = progress.skillByHref('/grammar/e2e-past-perfect');
    await expect(skill).toHaveCount(1);
    await expect(skill).not.toHaveClass(/skill--locked/);
    await expect(skill.locator('.skill__mastery')).toBeVisible();
  });

  test('marks the seeded review days on the activity calendar', async ({
    page,
  }) => {
    const progress = new ProfileProgressPage(page);
    await progress.goto();

    await expect(progress.calendar).toBeVisible();
    // The seed logs reviews on 3 consecutive days; other specs may add more.
    expect(await progress.activeDays().count()).toBeGreaterThanOrEqual(3);
  });
});
