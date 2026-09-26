import { expect, test } from '@playwright/test';
import { AUTHED_STATE } from './auth';
import { blockScripts } from './block-scripts';
import { ReaderPage } from './pages/reader-page';

// Guest part of the reader's info row: the level question (stored in a cookie so the
// server renders highlights for it) and the explored-words count
// (localStorage). Fixtures come from test/e2e/seed-web-e2e.ts.

const READER_SLUG = 'the-cartographer-at-dawn-E2Eread1';

test.describe('reader guest strip', () => {
  test('asks for a level once and remembers the pick', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const strip = page.locator('[data-reader-guest]');
    await strip.locator('summary').click();
    await expect(strip.getByText('What is your level?')).toBeVisible();

    await strip.getByRole('button', { name: 'B2', exact: true }).click();
    // The pick reloads the page, which closes the row again.
    await expect(strip.locator('.reader-info__level')).toHaveText('Level B2');
    await strip.locator('summary').click();
    await expect(strip.getByText('Your level: B2')).toBeVisible();
    await expect(strip.getByText('What is your level?')).toBeHidden();

    await page.reload();
    await expect(strip.locator('.reader-info__level')).toHaveText('Level B2');
    await strip.locator('summary').click();
    await expect(strip.getByText('Your level: B2')).toBeVisible();

    await strip.getByRole('button', { name: 'Change' }).click();
    await expect(strip.getByText('What is your level?')).toBeVisible();
  });

  test('Skip leaves the level unset and stops asking', async ({ page }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const strip = page.locator('[data-reader-guest]');
    await strip.locator('summary').click();
    await strip.getByRole('button', { name: 'Skip' }).click();
    await expect(strip.locator('.reader-info__level')).toHaveText('Set level');
    await strip.locator('summary').click();
    await expect(strip.getByText('Your level: not set')).toBeVisible();

    await page.reload();
    await strip.locator('summary').click();
    await expect(strip.getByText('What is your level?')).toBeHidden();
    await expect(
      strip.getByRole('button', { name: 'Set', exact: true }),
    ).toBeVisible();
  });

  test('counts each opened word once and keeps the count across reloads', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const count = page.locator('[data-explored]');
    await expect(count).toBeHidden();

    await reader.wordLabel('perambulate').click();
    await expect(count).toHaveText('1 word explored');
    await reader.wordLabel('perambulate').click();
    await reader.wordLabel('perambulate').click();
    await expect(count).toHaveText('1 word explored');

    await reader.phraseLabel('at loose ends').click();
    await expect(count).toHaveText('2 words explored');

    await page.reload();
    await expect(count).toHaveText('2 words explored');
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

  test('plays the saved animation when a guest adds a card, not when reopening it', async ({
    page,
  }) => {
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.wordLabel('perambulate').click();
    await reader.popup.getByRole('button', { name: 'Add to deck' }).click();
    const state = reader.popup.locator('.lex-actions--fresh .lex-state');
    await expect(state).toHaveText('Learning');
    await expect(state).toHaveCSS('animation-name', 'reward-badge');

    await page.reload();
    await reader.wordLabel('perambulate').click();
    await expect(reader.popup.locator('.lex-state--learning')).toBeVisible();
    await expect(reader.popup.locator('.lex-actions--fresh')).toHaveCount(0);
  });

  test('skips the reward animations for reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.wordLabel('perambulate').click();
    await reader.popup.getByRole('button', { name: 'Add to deck' }).click();
    await expect(
      reader.popup.locator('.lex-actions--fresh .lex-state'),
    ).toHaveCSS('animation-name', 'none');
  });

  test('pulses the header ring when the daily goal is reached, not on a later load', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (localStorage.getItem('guest-explored-days')) {
        return;
      }
      const now = new Date();
      const day = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
      ].join('-');
      localStorage.setItem('guest-explored-days', JSON.stringify({ [day]: 9 }));
    });
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const ring = page.locator('[data-guest-progress]').getByTestId('goal-ring');
    await expect(ring).toBeVisible();
    await expect(ring).not.toHaveClass(/goal--done/);

    await reader.wordLabel('perambulate').click();
    await expect(ring).toHaveClass(/goal--done/);
    await expect(ring).toHaveClass(/goal--reached/);
    await expect(ring).toHaveCSS('animation-name', 'reward-pulse');

    await page.reload();
    await expect(ring).toHaveClass(/goal--done/);
    await expect(ring).not.toHaveClass(/goal--reached/);
  });

  test('counts saved cards in the header and nudges a login at the third', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('guest-deck')) {
        localStorage.setItem(
          'guest-deck',
          JSON.stringify([
            { kind: 'word', id: 'seed-1' },
            { kind: 'word', id: 'seed-2' },
          ]),
        );
      }
    });
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const saved = page.locator('[data-guest-deck]');
    const nudge = page.locator('[data-nudge]');
    await expect(saved).toHaveText('2');
    await expect(nudge).toBeHidden();

    await reader.wordLabel('perambulate').click();
    await reader.popup.getByRole('button', { name: 'Add to deck' }).click();
    await expect(saved).toHaveText('3');
    await expect(nudge).toBeVisible();
    await expect(nudge.locator('[data-nudge-variant="saved"]')).toContainText(
      "You've saved 3 cards",
    );
    await expect(nudge.locator('[data-nudge-variant="explored"]')).toBeHidden();
    await expect(nudge.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login',
    );

    await nudge.getByRole('button', { name: 'Dismiss' }).click();
    await expect(nudge).toBeHidden();
    await page.reload();
    await expect(saved).toHaveText('3');
    await expect(nudge).toBeHidden();
  });

  test('nudges a login after ten explored words even with nothing saved', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('guest-explored')) {
        localStorage.setItem(
          'guest-explored',
          JSON.stringify(Array.from({ length: 9 }, (_, i) => `word:seed-${i}`)),
        );
      }
    });
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    const nudge = page.locator('[data-nudge]');
    await expect(nudge).toBeHidden();

    await reader.wordLabel('perambulate').click();
    await expect(nudge).toBeVisible();
    await expect(
      nudge.locator('[data-nudge-variant="explored"]'),
    ).toContainText("You've explored 10 words");
  });

  // Guest state that lives in localStorage must reach the first paint through
  // the head boot script: with the page scripts blocked, the reader has to sit
  // exactly where it sits once they've run, or the page jumps after load.
  for (const [name, viewport] of [
    ['desktop', { width: 1100, height: 700 }],
    ['phone', { width: 390, height: 844 }],
  ] as const) {
    test(`the reader does not shift when scripts run (${name})`, async ({
      browser,
    }) => {
      const firstParagraphY = async (scripts: boolean) => {
        const context = await browser.newContext({ viewport });
        await context.addInitScript(() => {
          localStorage.setItem(
            'guest-deck',
            JSON.stringify(
              [1, 2, 3].map((i) => ({ kind: 'word', id: `seed-${i}` })),
            ),
          );
          localStorage.setItem(
            'guest-explored',
            JSON.stringify(
              Array.from({ length: 12 }, (_, i) => `word:seed-${i}`),
            ),
          );
          localStorage.setItem('reader-hint', 'seen');
        });
        const page = await context.newPage();
        if (!scripts) {
          await blockScripts(page);
        }
        await page.goto(`/posts/${READER_SLUG}`);
        await expect(page.locator('[data-nudge]')).toBeVisible();
        const box = await page
          .locator('.reading-body > *')
          .first()
          .boundingBox();
        await context.close();
        return box?.y;
      };
      const beforeScripts = await firstParagraphY(false);
      const afterScripts = await firstParagraphY(true);
      expect(beforeScripts).toBeDefined();
      expect(beforeScripts).toBeCloseTo(afterScripts ?? -1, 0);
    });
  }

  test('never shows the nudge to a signed-in reader', async ({ browser }) => {
    const context = await browser.newContext({ storageState: AUTHED_STATE });
    const page = await context.newPage();
    await new ReaderPage(page).goto(READER_SLUG);
    await expect(page.locator('.reader-article')).toBeVisible();
    await expect(page.locator('[data-nudge]')).toHaveCount(0);
    await context.close();
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
