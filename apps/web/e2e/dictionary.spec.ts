import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { DictionaryPage } from './pages/dictionary-page';
import { PhraseDictionaryDetailPage } from './pages/phrase-dictionary-detail-page';
import { WordDictionaryDetailPage } from './pages/word-dictionary-detail-page';

// dictionary-redesign слайд 1 — /dictionary personal word/phrase list, now
// grouped by lemma with a state filter (Learning/Learned/Skipped) and
// server-side search, replacing the old client-side JS filter.
// слайд 2 — /dictionary/words/[lemma] detail page: every sense of the lemma,
// irregular-verb forms, the posts it appears in, and the known/skip/remove
// actions.
// слайд 3 — /dictionary/phrases/[phrase] detail page: definition/example, the
// posts it appears in, and the same known/skip/remove actions.

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
    await expect(word.locator('.tag')).toHaveText('Learning');
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

test.describe('word detail (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('404s an unknown lemma', async ({ page }) => {
    const detail = new WordDictionaryDetailPage(page);
    const res = await detail.goto('no-such-lemma-e2e');
    expect(res?.status()).toBe(404);
  });

  test('shows every sense and the posts using the word', async ({ page }) => {
    const detail = new WordDictionaryDetailPage(page);
    await detail.goto('perambulate');
    await detail.expectLoaded('perambulate');

    await expect(detail.senses).toHaveCount(2);

    const verbSense = detail.senseByPos('verb');
    await expect(verbSense).toContainText(
      'to walk through or around a place, especially for pleasure',
    );
    await expect(verbSense).toContainText('/pəˈrambjʊleɪt/');
    // Backed by an active card (see seed-web-e2e.ts) -> only "Видалити".
    await expect(
      verbSense.getByRole('button', { name: 'Видалити' }),
    ).toBeVisible();

    await expect(detail.posts).toContainText('Unread');
    await expect(
      detail.posts.getByRole('link', { name: 'The Cartographer at Dawn' }),
    ).toBeVisible();
  });

  test('marks an unsaved sense as known', async ({ page }) => {
    const detail = new WordDictionaryDetailPage(page);
    await detail.goto('perambulate');

    const nounSense = detail.senseByPos('noun');
    await nounSense.getByRole('button', { name: 'Позначити вивченим' }).click();

    await expect(nounSense).toContainText('Learned');
    await expect(
      nounSense.getByRole('button', { name: 'Пропустити' }),
    ).toBeVisible();
    await expect(
      nounSense.getByRole('button', { name: 'Позначити вивченим' }),
    ).toHaveCount(0);
  });
});

test.describe('phrase detail (signed in)', () => {
  test.use({ storageState: AUTHED_STATE });

  test('404s an unknown phrase', async ({ page }) => {
    const detail = new PhraseDictionaryDetailPage(page);
    const res = await detail.goto('no such phrase e2e');
    expect(res?.status()).toBe(404);
  });

  test('shows the phrase, its posts and the remove action', async ({
    page,
  }) => {
    const detail = new PhraseDictionaryDetailPage(page);
    await detail.goto('at loose ends');
    await detail.expectLoaded('at loose ends');

    await expect(detail.phrase).toContainText(
      'having nothing particular to do; unoccupied',
    );
    // Backed by an active card (see seed-web-e2e.ts) -> only "Видалити".
    await expect(
      detail.phrase.getByRole('button', { name: 'Видалити' }),
    ).toBeVisible();

    await expect(detail.posts).toContainText('Unread');
    await expect(
      detail.posts.getByRole('link', { name: 'The Cartographer at Dawn' }),
    ).toBeVisible();
  });

  test('the dictionary list links a phrase to its detail page', async ({
    page,
  }) => {
    const dictionary = new DictionaryPage(page);
    await dictionary.goto();
    await dictionary
      .entryByText('at loose ends')
      .getByRole('link', { name: 'at loose ends' })
      .click();
    await expect(page).toHaveURL('/dictionary/phrases/at%20loose%20ends');
  });

  test('marks an unsaved phrase as known', async ({ page }) => {
    const detail = new PhraseDictionaryDetailPage(page);
    await detail.goto('under the weather');

    await detail.phrase
      .getByRole('button', { name: 'Позначити вивченим' })
      .click();

    await expect(detail.phrase).toContainText('Learned');
    await expect(
      detail.phrase.getByRole('button', { name: 'Пропустити' }),
    ).toBeVisible();
    await expect(
      detail.phrase.getByRole('button', { name: 'Позначити вивченим' }),
    ).toHaveCount(0);
  });
});
