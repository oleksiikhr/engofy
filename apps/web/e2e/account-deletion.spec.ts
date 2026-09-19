import { expect, test } from '@playwright/test';
import { AccountDeletionCancelPage } from './pages/account-deletion-cancel-page';

// /account-deletion/cancel — landing page of the e-mailed cancel link.

// The happy path (seeded token → cancelled) lives in profile.spec.ts, serial
// with the other specs that mutate the seeded deletion user.

test('a missing token shows the invalid-link message', async ({ page }) => {
  const cancel = new AccountDeletionCancelPage(page);
  await cancel.goto();
  await expect(cancel.invalid).toBeVisible();
});

test('an unknown token is rejected', async ({ page }) => {
  const cancel = new AccountDeletionCancelPage(page);
  await cancel.goto('not-a-real-token-at-all-0000');
  await cancel.confirmButton.click();
  await expect(cancel.invalid).toBeVisible();
});
