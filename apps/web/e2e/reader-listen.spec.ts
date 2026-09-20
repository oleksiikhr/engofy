import { expect, type Page, test } from '@playwright/test';
import { ReaderPage } from './pages/reader-page';

// Read-aloud: a play button per paragraph, and "Read the sentence" in the
// popup. The Web Speech API is stubbed so the spec records what would be
// spoken; `finishSpeaking` plays the end of the last queued utterance.

const READER_SLUG = 'the-cartographer-at-dawn-E2Eread1';

async function stubSpeech(page: Page) {
  await page.addInitScript(() => {
    const spoken: string[] = [];
    const cancelled = { value: 0 };
    const paused = { value: false };
    let last: { onend: (() => void) | null } | null = null;
    class FakeUtterance {
      lang = '';
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(public text: string) {}
    }
    const w = window as unknown as Record<string, unknown>;
    w.SpeechSynthesisUtterance = FakeUtterance;
    w.__spoken = spoken;
    w.__paused = paused;
    w.__cancelled = cancelled;
    w.__finishSpeaking = () => last?.onend?.();
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak(u: FakeUtterance) {
          spoken.push(u.text);
          last = u;
        },
        cancel() {
          cancelled.value++;
        },
        pause() {
          paused.value = true;
        },
        resume() {
          paused.value = false;
        },
      },
    });
  });
}

const spoken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

const finishSpeaking = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __finishSpeaking: () => void }).__finishSpeaking(),
  );

const isPaused = (page: Page) =>
  page.evaluate(
    () =>
      (window as unknown as { __paused: { value: boolean } }).__paused.value,
  );

test.describe('reader read-aloud', () => {
  test('reads a paragraph and flips the button back when it ends', async ({
    page,
  }) => {
    await stubSpeech(page);
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const paragraph = reader.analysis.locator('p[data-block]').first();
    const button = paragraph.getByRole('button', { name: 'Read this aloud' });
    await button.click();

    expect(await spoken(page)).toEqual([
      'The old cartographer would perambulate the harbour at dawn, at loose ends until the boats returned.',
    ]);
    const stop = paragraph.getByRole('button', { name: 'Stop reading' });
    await expect(stop).toHaveAttribute('aria-pressed', 'true');
    await expect(paragraph).toHaveClass(/is-reading/);

    await page.evaluate(() =>
      (
        window as unknown as { __finishSpeaking: () => void }
      ).__finishSpeaking(),
    );
    await expect(
      paragraph.getByRole('button', { name: 'Read this aloud' }),
    ).toBeVisible();
    await expect(paragraph).not.toHaveClass(/is-reading/);
  });

  test('the popup reads only the sentence the label is in, and its example', async ({
    page,
  }) => {
    await stubSpeech(page);
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.grammarLabel('had drawn').click();
    await reader.popup
      .getByRole('button', { name: 'Read the sentence' })
      .click();
    expect(await spoken(page)).toEqual([
      'By the time the war ended, she had drawn every coastline twice.',
    ]);

    await reader
      .popupSection('grammar')
      .getByRole('button', { name: 'Read the example aloud' })
      .click();
    expect((await spoken(page)).at(-1)).toBe(
      'She had drawn the map before he arrived.',
    );
  });

  test('Listen reads the whole text block by block, highlighting the current one', async ({
    page,
  }) => {
    await stubSpeech(page);
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    const units = reader.analysis.locator(
      '[data-block]:not(ul):not(ol), li[data-item]',
    );
    const count = await units.count();
    expect(count).toBeGreaterThan(1);

    await reader.toolbar.getByRole('button', { name: 'Listen' }).click();
    await expect(units.first()).toHaveClass(/is-reading/);
    await expect(units.nth(1)).not.toHaveClass(/is-reading/);
    const first = await spoken(page);
    expect(first[0]).toContain('The old cartographer');

    // The end of the first block starts the second and moves the highlight.
    await finishSpeaking(page);
    await expect(units.nth(1)).toHaveClass(/is-reading/);
    await expect(units.first()).not.toHaveClass(/is-reading/);

    // Every remaining block plays, then the toolbar returns to Listen.
    for (let i = 2; i <= count; i++) {
      await finishSpeaking(page);
    }
    await expect(
      reader.toolbar.getByRole('button', { name: 'Listen' }),
    ).toBeVisible();
    await expect(page.locator('.is-reading')).toHaveCount(0);
  });

  test('Listen can be paused, resumed and stopped', async ({ page }) => {
    await stubSpeech(page);
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);

    await reader.toolbar.getByRole('button', { name: 'Listen' }).click();
    await reader.toolbar.getByRole('button', { name: 'Pause' }).click();
    expect(await isPaused(page)).toBe(true);
    await reader.toolbar.getByRole('button', { name: 'Resume' }).click();
    expect(await isPaused(page)).toBe(false);

    await reader.toolbar.getByRole('button', { name: 'Stop' }).click();
    await expect(
      reader.toolbar.getByRole('button', { name: 'Listen' }),
    ).toBeVisible();
    await expect(page.locator('.is-reading')).toHaveCount(0);

    // A stopped run does not carry on into the next block.
    const before = (await spoken(page)).length;
    await finishSpeaking(page);
    expect(await spoken(page)).toHaveLength(before);
  });

  test('leaving the page stops the reading', async ({ page }) => {
    await stubSpeech(page);
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await reader.toolbar.getByRole('button', { name: 'Listen' }).click();
    await expect(page.locator('.is-reading')).toHaveCount(1);

    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    await expect(page.locator('.is-reading')).toHaveCount(0);
    await expect(
      reader.toolbar.getByRole('button', { name: 'Listen' }),
    ).toBeVisible();
  });

  for (const [name, viewport] of [
    ['desktop', { width: 1100, height: 700 }],
    ['phone', { width: 390, height: 844 }],
  ] as const) {
    test(`Listen appearing does not shift the reader (${name})`, async ({
      browser,
    }) => {
      const firstParagraphY = async (scripts: boolean) => {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        await stubSpeech(page);
        if (!scripts) {
          await page.route('**/_astro/**', (route) => route.abort());
        }
        await page.goto(`/posts/${READER_SLUG}`);
        if (scripts) {
          await expect(
            page.getByRole('button', { name: 'Listen' }),
          ).toBeVisible();
        }
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

  test('has no Listen button when speech synthesis is missing', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(window, 'speechSynthesis');
    });
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await expect(reader.analysis).toContainText('perambulate');
    await expect(
      reader.toolbar.getByRole('button', { name: 'Listen' }),
    ).toBeHidden();
  });

  test('has no read-aloud buttons when speech synthesis is missing', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(window, 'speechSynthesis');
    });
    const reader = new ReaderPage(page);
    await reader.goto(READER_SLUG);
    await expect(reader.analysis).toContainText('perambulate');
    await expect(page.locator('.listen-btn')).toHaveCount(0);

    await reader.wordLabel('perambulate').click();
    await expect(reader.popup).toBeVisible();
    await expect(reader.popup.locator('[data-speak]')).toHaveCount(0);
    await expect(reader.popup.locator('[data-speak-sentence]')).toHaveCount(0);
  });
});
