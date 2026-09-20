import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { ReaderPage } from './pages/reader-page';

// Guest strip above the article: the level question (stored in a cookie so the
// server renders highlights for it) and the explored-words count
// (localStorage). Fixtures come from test/e2e/seed-web-e2e.ts.

const READER_SLUG = 'the-cartographer-at-dawn-E2Eread1';

test.describe('reader guest strip', () => {
  test('asks for a level once and remembers the pick', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const strip = page.locator('[data-reader-guest]');
    await expect(strip.getByText('What is your level?')).toBeVisible();

    await strip.getByRole('button', { name: 'B2', exact: true }).click();
    await expect(strip.getByText('Your level: B2')).toBeVisible();
    await expect(strip.getByText('What is your level?')).toBeHidden();

    await page.reload();
    await expect(strip.getByText('Your level: B2')).toBeVisible();

    await strip.getByRole('button', { name: 'Change' }).click();
    await expect(strip.getByText('What is your level?')).toBeVisible();
  });

  test('Skip leaves the level unset and stops asking', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const strip = page.locator('[data-reader-guest]');
    await strip.getByRole('button', { name: 'Skip' }).click();
    await expect(strip.getByText('Your level: not set')).toBeVisible();

    await page.reload();
    await expect(strip.getByText('What is your level?')).toBeHidden();
    await expect(strip.getByRole('button', { name: 'Set' })).toBeVisible();
  });

  test('counts each opened word once and keeps the count across reloads', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const count = page.locator('[data-explored]');
    await expect(count).toBeHidden();

    await reader.wordLabel('perambulate').click();
    await expect(count).toHaveText("You've explored 1 word");
    await reader.wordLabel('perambulate').click();
    await reader.wordLabel('perambulate').click();
    await expect(count).toHaveText("You've explored 1 word");

    await reader.phraseLabel('at loose ends').click();
    await expect(count).toHaveText("You've explored 2 words");

    await page.reload();
    await expect(count).toHaveText("You've explored 2 words");
  });

  test('shows a guest day streak and daily ring in the header once a word is explored', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const progress = page.locator('[data-guest-progress]');
    await expect(progress).toBeHidden();

    await reader.wordLabel('perambulate').click();
    await expect(progress).toBeVisible();
    await expect(progress.locator('[data-guest-streak]')).toHaveText('1');
    await expect(progress.getByTestId('goal-ring')).toHaveAttribute(
      'title',
      '1 of 10 words today',
    );

    await page.reload();
    await expect(progress.locator('[data-guest-streak]')).toHaveText('1');
  });

  test('has no strip for a signed-in reader', async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTHED_STATE });
    const page = await context.newPage();
    await new ReaderPage(page).goto(READER_SLUG);
    await expect(page.locator('.reader-article')).toBeVisible();
    await expect(page.locator('[data-reader-guest]')).toHaveCount(0);
    await context.close();
  });
});
