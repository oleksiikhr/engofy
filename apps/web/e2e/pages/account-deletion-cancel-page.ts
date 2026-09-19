import type { Locator, Page } from '@playwright/test';

// /account-deletion/cancel?token=… — the e-mailed cancel link's landing page.
export class AccountDeletionCancelPage {
  readonly page: Page;
  readonly confirmButton: Locator;
  readonly done: Locator;
  readonly invalid: Locator;

  constructor(page: Page) {
    this.page = page;
    this.confirmButton = page.getByRole('button', { name: 'Keep my account' });
    this.done = page.getByTestId('cancel-deletion-done');
    this.invalid = page.getByTestId('cancel-deletion-invalid');
  }

  async goto(token?: string) {
    await this.page.goto(
      token
        ? `/account-deletion/cancel?token=${encodeURIComponent(token)}`
        : '/account-deletion/cancel',
    );
  }
}
