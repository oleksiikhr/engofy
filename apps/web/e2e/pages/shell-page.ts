import { expect, type Locator, type Page } from '@playwright/test';

// The site header and footer, shared by every page.
export class ShellPage {
  readonly page: Page;
  readonly mainNav: Locator;
  readonly logo: Locator;
  readonly accountToggle: Locator;
  readonly accountMenu: Locator;
  readonly themeGroup: Locator;
  readonly logOutButton: Locator;
  readonly footer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.mainNav = page.getByRole('navigation', { name: 'Main' });
    this.logo = page.getByRole('banner').getByRole('link', { name: 'Engofy' });
    this.accountToggle = page.getByLabel('Account menu');
    this.accountMenu = page.locator('[data-account-menu] .menu');
    this.themeGroup = this.accountMenu.getByRole('group', { name: 'Theme' });
    this.logOutButton = this.accountMenu.getByRole('button', {
      name: 'Log out',
    });
    this.footer = page.getByRole('contentinfo');
  }

  async openAccountMenu() {
    await this.accountToggle.click();
    await expect(this.accountMenu).toBeVisible();
  }

  themeButton(name: 'Auto' | 'Light' | 'Dark') {
    return this.themeGroup.getByRole('button', { name });
  }
}
