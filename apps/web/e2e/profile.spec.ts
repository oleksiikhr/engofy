import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';

// Slice 8b page 6 — /profile skills tree, streak, CEFR breakdown.

test('profile prompts a guest to sign in', async ({ page }) => {
  await page.goto('/profile');
  await expect(
    page.getByRole('heading', { name: 'Your progress' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test.describe('profile (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('shows the review streak, CEFR bars and an unlocked construction', async ({
    page,
  }) => {
    await page.goto('/profile');

    // 3 consecutive seeded review days.
    await expect(
      page.locator('.stat', { hasText: 'day streak' }),
    ).toContainText('3');

    // Seeded cards: word B1, phrase B2 (grammar A2). B1/B2 are stable across
    // the suite; A1/A2 shift as other specs add cards.
    await expect(page.getByTestId('cefr-B1')).toContainText('1');
    await expect(page.getByTestId('cefr-B2')).toContainText('1');

    // past perfect (the seeded E2E one) was seeded with an unlock + mastery.
    const skill = page.locator('.skill', {
      has: page.locator('a[href="/grammar/e2e-past-perfect"]'),
    });
    await expect(skill).toHaveCount(1);
    await expect(skill).not.toHaveClass(/skill--locked/);
    await expect(skill.locator('.skill__mastery')).toBeVisible();
  });
});
