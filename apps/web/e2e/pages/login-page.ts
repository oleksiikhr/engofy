import { expect, type Locator, type Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly emailInput: Locator;
  readonly emailSubmitButton: Locator;
  readonly codeSentText: Locator;
  readonly codeInput: Locator;
  readonly codeDigits: Locator;
  readonly verifyButton: Locator;
  readonly alert: Locator;
  readonly accountMenuToggle: Locator;
  readonly logOutButton: Locator;
  readonly logInLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Sign in' });
    this.emailInput = page.getByLabel('Email address');
    this.emailSubmitButton = page.getByRole('button', {
      name: 'Email me a code',
    });
    this.codeSentText = page.getByText('We sent a 6-digit code');
    this.codeInput = page.getByRole('group', { name: '6-digit code' });
    this.codeDigits = page.getByLabel(/^Digit \d$/);
    this.verifyButton = page.getByRole('button', {
      name: 'Verify and sign in',
    });
    this.alert = page.getByRole('alert');
    this.accountMenuToggle = page.getByLabel('Account menu');
    this.logOutButton = page.getByRole('button', { name: 'Log out' });
    // The guest landing also carries a CTA "Log in"; the header one comes first.
    this.logInLink = page.getByRole('link', { name: 'Log in' }).first();
  }

  async goto() {
    await this.page.goto('/login');
  }

  async gotoCodeStep(email: string) {
    await this.page.goto(`/login?step=code&email=${encodeURIComponent(email)}`);
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible();
  }

  async submitEmail(email: string) {
    await this.emailInput.fill(email);
    await this.emailSubmitButton.click();
  }

  async submitCode(code: string) {
    // Typing into the first box advances through the six.
    await this.codeDigits.first().pressSequentially(code);
    await this.verifyButton.click();
  }

  // Log out lives in the header's account menu; open it before logOut().
  async openAccountMenu() {
    await this.accountMenuToggle.click();
  }

  async logOut() {
    await this.logOutButton.click();
  }
}
