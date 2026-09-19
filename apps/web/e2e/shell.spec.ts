import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { ShellPage } from './pages/shell-page';

test.describe('guest shell', () => {
  test('the header offers Log in and Get started instead of an account menu', async ({
    page,
  }) => {
    const shell = new ShellPage(page);
    await page.goto('/posts');

    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(
      header.getByRole('link', { name: 'Get started' }),
    ).toBeVisible();
    await expect(shell.accountToggle).toHaveCount(0);
  });

  test('the main nav has Posts, Dictionary and Grammar only', async ({
    page,
  }) => {
    const shell = new ShellPage(page);
    await page.goto('/');

    await expect(shell.mainNav.getByRole('link')).toHaveText([
      'Posts',
      'Dictionary',
      'Grammar',
    ]);
  });

  test('the footer links to Pricing, the header does not', async ({ page }) => {
    const shell = new ShellPage(page);
    await page.goto('/');

    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Pricing' }),
    ).toHaveCount(0);
    await shell.footer.getByRole('link', { name: 'Pricing' }).click();
    await expect(page).toHaveURL('/pricing');
  });

  test('the logo leads home', async ({ page }) => {
    const shell = new ShellPage(page);
    await page.goto('/grammar');
    await shell.logo.click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('signed-in shell', () => {
  test.use({ storageState: AUTHED_STATE });

  test('the main nav has Posts, Practice, Dictionary and Grammar, no Today', async ({
    page,
  }) => {
    const shell = new ShellPage(page);
    await page.goto('/posts');

    const links = shell.mainNav.getByRole('link');
    await expect(links).toHaveCount(4);
    await expect(links.nth(0)).toHaveText('Posts');
    await expect(links.nth(1)).toContainText('Practice');
    await expect(links.nth(2)).toHaveText('Dictionary');
    await expect(links.nth(3)).toHaveText('Grammar');
    await expect(
      shell.mainNav.getByRole('link', { name: 'Today' }),
    ).toHaveCount(0);
    await expect(
      shell.mainNav.getByRole('link', { name: 'Posts' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('the avatar shows the first letter of the email and opens the menu', async ({
    page,
  }) => {
    const shell = new ShellPage(page);
    await page.goto('/posts');

    await expect(shell.accountToggle).toHaveText(/^[A-Z0-9]$/);
    await expect(shell.accountMenu).toBeHidden();
    await shell.openAccountMenu();

    for (const [name, href] of [
      ['Profile', '/profile'],
      ['Progress', '/profile/progress'],
      ['Subscription', '/profile/subscription'],
    ] as const) {
      await expect(
        shell.accountMenu.getByRole('link', { name }),
      ).toHaveAttribute('href', href);
    }
    await expect(shell.logOutButton).toBeVisible();
  });

  test('Escape closes the menu and returns focus to the avatar', async ({
    page,
  }) => {
    const shell = new ShellPage(page);
    await page.goto('/posts');

    await shell.openAccountMenu();
    await page.keyboard.press('Escape');
    await expect(shell.accountMenu).toBeHidden();
    await expect(shell.accountToggle).toBeFocused();
  });

  test('clicking outside closes the menu', async ({ page }) => {
    const shell = new ShellPage(page);
    await page.goto('/posts');

    await shell.openAccountMenu();
    await page.locator('main').click({ position: { x: 5, y: 300 } });
    await expect(shell.accountMenu).toBeHidden();
  });

  test('the menu opens from the keyboard', async ({ page }) => {
    const shell = new ShellPage(page);
    await page.goto('/posts');

    await shell.accountToggle.focus();
    await page.keyboard.press('Enter');
    await expect(shell.accountMenu).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(
      shell.accountMenu.getByRole('link', { name: 'Profile' }),
    ).toBeFocused();
  });

  test('the theme switch applies, persists across a reload and can return to Auto', async ({
    page,
  }) => {
    const shell = new ShellPage(page);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/posts');
    const html = page.locator('html');

    await shell.openAccountMenu();
    await expect(shell.themeButton('Auto')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await shell.themeButton('Dark').click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(shell.themeButton('Dark')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await shell.openAccountMenu();
    await expect(shell.themeButton('Dark')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await shell.themeButton('Auto').click();
    await expect(html).not.toHaveAttribute('data-theme', /.*/);
  });

  test('the footer links to Pricing, the header does not', async ({ page }) => {
    const shell = new ShellPage(page);
    await page.goto('/posts');

    await expect(
      page.getByRole('banner').getByRole('link', { name: 'Pricing' }),
    ).toHaveCount(0);
    await expect(
      shell.footer.getByRole('link', { name: 'Pricing' }),
    ).toBeVisible();
  });
});
