import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { DictionaryPage } from './pages/dictionary-page';

// Slice 8b page 5 — /dictionary personal word/phrase deck.

test('dictionary prompts a guest to sign in', async ({ page }) => {
  const dictionary = new DictionaryPage(page);
  await dictionary.goto();
  await dictionary.expectLoaded();
  await expect(dictionary.signInLink).toBeVisible();
});

test.describe('dictionary (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('lists saved words and phrases with context', async ({ page }) => {
    const dictionary = new DictionaryPage(page);
    await dictionary.goto();

    const word = dictionary.entryByText('perambulate');
    await expect(word).toContainText(
      'to walk through or around a place, especially for pleasure',
    );
    await expect(
      word.getByRole('link', { name: 'The Cartographer at Dawn' }),
    ).toBeVisible();

    await expect(dictionary.entryByText('at loose ends')).toBeVisible();
  });

  test('search and status filters narrow the list', async ({ page }) => {
    const dictionary = new DictionaryPage(page);
    await dictionary.goto();

    await dictionary.search('loose');
    await expect(dictionary.entryByText('at loose ends')).toBeVisible();
    await expect(dictionary.entryByText('perambulate')).toBeHidden();

    await dictionary.search('');
    await dictionary.filterByStatus('review');
    await expect(dictionary.entryByText('perambulate')).toBeVisible();
    await expect(dictionary.entryByText('at loose ends')).toBeHidden();
  });
});
