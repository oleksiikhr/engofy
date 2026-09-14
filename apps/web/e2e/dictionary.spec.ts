import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { DictionaryPage } from './pages/dictionary-page';

// dictionary-redesign слайд 1 — /dictionary personal word/phrase list, now
// grouped by lemma with a state filter (Learning/Learned/Skipped) and
// server-side search, replacing the old client-side JS filter.

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

  test('search narrows the list', async ({ page }) => {
    const dictionary = new DictionaryPage(page);
    await dictionary.goto();

    await dictionary.search('loose');
    await expect(dictionary.entryByText('at loose ends')).toBeVisible();
    await expect(dictionary.entryByText('perambulate')).toBeHidden();
  });

  test('the state filter narrows the list to one effective state', async ({
    page,
  }) => {
    const dictionary = new DictionaryPage(page);
    await dictionary.goto();

    // Seeded: perambulate/at loose ends have an active card (state
    // "learning"); "a piece of cake" is a Known disposition with no card
    // (state "learned"); "break a leg" is a Skipped disposition (state
    // "skipped") — see test/e2e/seed-web-e2e.ts.
    await dictionary.filterByStatus('learning');
    await expect(dictionary.entryByText('perambulate')).toBeVisible();
    await expect(dictionary.entryByText('at loose ends')).toBeVisible();
    await expect(dictionary.entryByText('a piece of cake')).toBeHidden();
    await expect(dictionary.entryByText('break a leg')).toBeHidden();

    await dictionary.filterByStatus('learned');
    await expect(dictionary.entryByText('a piece of cake')).toBeVisible();
    await expect(dictionary.entryByText('perambulate')).toBeHidden();

    await dictionary.filterByStatus('skipped');
    await expect(dictionary.entryByText('break a leg')).toBeVisible();
    await expect(dictionary.entryByText('a piece of cake')).toBeHidden();
  });
});
