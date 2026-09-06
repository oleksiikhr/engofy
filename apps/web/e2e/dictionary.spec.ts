import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';

// Slice 8b page 5 — /dictionary personal word/phrase deck.

test('dictionary prompts a guest to sign in', async ({ page }) => {
  await page.goto('/dictionary');
  await expect(
    page.getByRole('heading', { name: 'Your dictionary' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test.describe('dictionary (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('lists saved words and phrases with context', async ({ page }) => {
    await page.goto('/dictionary');

    const word = page.locator('.dict-entry', { hasText: 'perambulate' });
    await expect(word).toContainText(
      'to walk through or around a place, especially for pleasure',
    );
    await expect(
      word.getByRole('link', { name: 'The Cartographer at Dawn' }),
    ).toBeVisible();

    await expect(
      page.locator('.dict-entry', { hasText: 'at loose ends' }),
    ).toBeVisible();
  });

  test('search and status filters narrow the list', async ({ page }) => {
    await page.goto('/dictionary');

    await page.getByLabel('Search your dictionary').fill('loose');
    await expect(
      page.locator('.dict-entry', { hasText: 'at loose ends' }),
    ).toBeVisible();
    await expect(
      page.locator('.dict-entry', { hasText: 'perambulate' }),
    ).toBeHidden();

    await page.getByLabel('Search your dictionary').fill('');
    await page.getByLabel('Filter by status').selectOption('review');
    await expect(
      page.locator('.dict-entry', { hasText: 'perambulate' }),
    ).toBeVisible();
    await expect(
      page.locator('.dict-entry', { hasText: 'at loose ends' }),
    ).toBeHidden();
  });
});
