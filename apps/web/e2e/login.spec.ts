import { expect, test } from '@playwright/test';

// Slice 8b page 7 — /login (email + OTP, two steps) and /logout.
// Fixture: test/e2e/seed-web-e2e.ts seeds a pending challenge for
// login-e2e@engofy.test with OTP 424242 (no user yet).

test('shows the email step and advances to the code step', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  await page
    .getByLabel('Email address')
    .fill(`throwaway-${Date.now()}@example.com`);
  await page.getByRole('button', { name: 'Email me a code' }).click();

  await expect(page.getByText('We sent a 6-digit code')).toBeVisible();
  await expect(page.getByLabel('6-digit code')).toBeVisible();
});

test('rejects a wrong code', async ({ page }) => {
  await page.goto('/login?step=code&email=login-e2e@engofy.test');
  await page.getByLabel('6-digit code').fill('000000');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('did not match');
});

test('signs in with the OTP and then signs out', async ({ page }) => {
  await page.goto('/login?step=code&email=login-e2e@engofy.test');
  await page.getByLabel('6-digit code').fill('424242');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});
