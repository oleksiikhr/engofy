import { expect, test } from '@playwright/test';
import { LoginPage } from './pages/login-page';

// /login (email + OTP, two steps) and /logout.
// Fixture: test/e2e/seed-web-e2e.ts seeds a pending challenge for
// login-e2e@engofy.test with OTP 424242 (no user yet).

test('shows the email step and advances to the code step', async ({ page }) => {
  const login = new LoginPage(page);
  await login.goto();
  await login.expectLoaded();

  await login.submitEmail(`throwaway-${Date.now()}@example.com`);

  await expect(login.codeSentText).toBeVisible();
  await expect(login.codeInput).toBeVisible();
  await expect(login.codeDigits).toHaveCount(6);
});

test('typing a code fills the six boxes in order', async ({ page }) => {
  const login = new LoginPage(page);
  await login.gotoCodeStep('login-e2e@engofy.test');
  await login.codeDigits.first().pressSequentially('123456');
  await expect(login.codeDigits.nth(0)).toHaveValue('1');
  await expect(login.codeDigits.nth(5)).toHaveValue('6');
});

test('pasting a code fills the six boxes', async ({ page }) => {
  const login = new LoginPage(page);
  await login.gotoCodeStep('login-e2e@engofy.test');
  await login.codeDigits.first().evaluate((el) => {
    const data = new DataTransfer();
    data.setData('text', '424242');
    el.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
  await expect(login.codeDigits.nth(3)).toHaveValue('2');
  await expect(login.codeDigits.nth(5)).toHaveValue('2');
});

test('rejects a wrong code', async ({ page }) => {
  const login = new LoginPage(page);
  await login.gotoCodeStep('login-e2e@engofy.test');
  await login.submitCode('000000');
  await expect(login.alert).toContainText('did not match');
});

test('signs in with the OTP and then signs out', async ({ page }) => {
  const login = new LoginPage(page);
  await login.gotoCodeStep('login-e2e@engofy.test');
  await login.submitCode('424242');

  await expect(page).toHaveURL('/');
  await login.openAccountMenu();
  await expect(login.logOutButton).toBeVisible();

  await login.logOut();
  await expect(page).toHaveURL('/');
  await expect(login.logInLink).toBeVisible();
});
