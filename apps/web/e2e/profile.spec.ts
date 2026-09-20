import { expect, test } from '@playwright/test';
import { AUTHED_STATE, DELETION_STATE } from './auth';
import { AccountDeletionCancelPage } from './pages/account-deletion-cancel-page';
import { ProfilePage } from './pages/profile-page';

// /profile — the light hub: streak, plan status, level editor, deletion.

test('profile prompts a guest to sign in', async ({ page }) => {
  const profile = new ProfilePage(page);
  await profile.goto();
  await profile.expectLoaded();
  await expect(profile.signInLink).toBeVisible();
});

test.describe('profile (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('shows the streak, plan status and links to the sub-pages', async ({
    page,
  }) => {
    const profile = new ProfilePage(page);
    await profile.goto();
    await profile.expectLoaded();

    await expect(page.getByTestId('profile-greeting')).toContainText(
      'e2e@engofy.test',
    );
    // 3 consecutive seeded review days.
    await expect(profile.streakStat).toContainText('3');
    await expect(profile.dailyPlanStatus).toContainText(/Done|Not done/);
    // Free or Premium depending on whether the pricing spec already ran.
    await expect(profile.planStatus).toContainText(/Free|Premium/);
    await expect(
      page.getByRole('link', { name: 'Progress & skills' }),
    ).toHaveAttribute('href', '/profile/progress');
    await expect(
      page.getByRole('link', { name: 'Subscription' }),
    ).toHaveAttribute('href', '/profile/subscription');
    await expect(profile.deletionBanner).toHaveCount(0);
  });

  test('saves a new content difficulty level', async ({ page }) => {
    const profile = new ProfilePage(page);
    await profile.goto();
    const before = await profile.levelForm
      .getByRole('radio', { checked: true })
      .inputValue();
    const next = before === 'C1' ? 'B2' : 'C1';

    await profile.saveLevel(next);
    await expect(profile.levelOption(next)).toBeChecked();

    // Restore, so the persisted level doesn't leak into other specs.
    await profile.saveLevel(before);
    await expect(profile.levelOption(before)).toBeChecked();
  });

  test('saves a new daily goal and the header ring reflects it', async ({
    page,
  }) => {
    const profile = new ProfilePage(page);
    await profile.goto();
    const input = profile.goalForm.getByLabel('Cards per day');
    const before = Number(await input.inputValue());
    const next = before === 25 ? 30 : 25;

    await profile.saveGoal(next);
    await expect(input).toHaveValue(String(next));
    await expect(page.getByTestId('goal-ring')).toHaveAttribute(
      'data-goal-target',
      String(next),
    );

    // Restore, so the persisted goal doesn't leak into other specs.
    await profile.saveGoal(before);
    await expect(input).toHaveValue(String(before));
  });
});

// Must match E2E_DELETION_CANCEL_TOKEN in test/e2e/seed-web-e2e.ts.
const CANCEL_TOKEN = 'e2e-deletion-cancel-token-000000';

// Own seeded user (pending deletion request), so nothing here touches the
// shared e2e user. Serial: each step relies on the state the previous left.
test.describe('account deletion', () => {
  test.use({ storageState: DELETION_STATE });
  test.describe.configure({ mode: 'serial' });

  test('cancels the pending deletion from the e-mailed link without a session', async ({
    page,
    browser,
  }) => {
    const profile = new ProfilePage(page);
    await profile.goto();
    await expect(profile.deletionBanner).toContainText(
      'scheduled for deletion',
    );
    await expect(profile.deleteAccount).toHaveCount(0);

    // A guest context proves the token alone is the credential.
    const guest = await browser.newContext({ storageState: undefined });
    const cancel = new AccountDeletionCancelPage(await guest.newPage());
    await cancel.goto(CANCEL_TOKEN);
    await cancel.confirmButton.click();
    await expect(cancel.done).toBeVisible();
    await guest.close();

    await profile.goto();
    await expect(profile.deletionBanner).toHaveCount(0);
    await expect(profile.deleteAccount).toBeVisible();
  });

  test('requests deletion and cancels it from the banner', async ({ page }) => {
    const profile = new ProfilePage(page);
    await profile.goto();

    await profile.deleteAccount.locator('summary').click();
    await profile.deleteAccount
      .getByRole('button', { name: 'Delete my account' })
      .click();
    await expect(profile.deletionBanner).toContainText(
      'scheduled for deletion',
    );

    await profile.deletionBanner
      .getByRole('button', { name: 'Cancel deletion' })
      .click();
    await expect(profile.deletionBanner).toHaveCount(0);
    await expect(profile.deleteAccount).toBeVisible();
  });
});
