import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';

// Slice 8b page 4 — /grammar reference (19 -> 90, CEFR filter) and
// /grammar/{slug} construction detail.

test.describe('grammar reference', () => {
  test('lists categories and constructions', async ({ page }) => {
    await page.goto('/grammar');
    await expect(
      page.getByRole('heading', { name: 'Grammar reference' }),
    ).toBeVisible();

    const cat = page.locator('.grammar-cat', { hasText: 'E2E: Tenses' });
    await expect(cat.getByRole('link', { name: /past perfect/ })).toBeVisible();
    await expect(
      cat.getByRole('link', { name: /present simple/ }),
    ).toBeVisible();
  });

  test('filters by CEFR level (SSR)', async ({ page }) => {
    await page.goto('/grammar?cefr=A1');
    const cat = page.locator('.grammar-cat', { hasText: 'E2E: Tenses' });
    await expect(
      cat.getByRole('link', { name: /present simple/ }),
    ).toBeVisible();
    await expect(cat.getByRole('link', { name: /past perfect/ })).toHaveCount(
      0,
    );
  });

  test('filters by CEFR level (HTMX chip)', async ({ page }) => {
    await page.goto('/grammar');
    await page.getByRole('link', { name: 'A1', exact: true }).click();
    await expect(page).toHaveURL('/grammar?cefr=A1');
    const cat = page.locator('.grammar-cat', { hasText: 'E2E: Tenses' });
    await expect(cat.getByRole('link', { name: /past perfect/ })).toHaveCount(
      0,
    );
    await expect(page.locator('.chip--on')).toHaveText('A1');
  });

  test('404s an unknown construction', async ({ page }) => {
    const res = await page.goto('/grammar/no-such-construction');
    expect(res?.status()).toBe(404);
  });
});

test.describe('grammar construction detail', () => {
  test('shows the cheat sheet and usage points', async ({ page }) => {
    await page.goto('/grammar/e2e-past-perfect');

    await expect(
      page.getByRole('heading', { name: 'past perfect' }),
    ).toBeVisible();
    await expect(page.locator('.con-head .badge')).toHaveText('A2');
    await expect(page.locator('.cheat')).toContainText('Form');
    await expect(page.locator('.usage-item')).toHaveCount(2);
  });

  test('guest gets a sign-in prompt from "+"', async ({ page }) => {
    await page.goto('/grammar/e2e-past-perfect');
    await page
      .locator('.usage-item')
      .first()
      .getByRole('button', { name: '+ Add to deck' })
      .click();
    await expect(page.locator('.usage-item').first()).toContainText(
      'Sign in to save',
    );
  });

  test.describe('signed in', () => {
    test.use({ storageState: AUTHED_STATE });

    test('adds a usage point to the deck', async ({ page }) => {
      await page.goto('/grammar/e2e-present-simple');
      const item = page.locator('.usage-item').first();
      await item.getByRole('button', { name: '+ Add to deck' }).click();
      await expect(item).toContainText('✓ Saved');
    });
  });
});
