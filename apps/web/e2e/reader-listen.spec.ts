import { expect, type Page, test } from '@playwright/test';
import { ReaderPage } from './pages/reader-page';

// Read-aloud: a play button per paragraph, and "Read the sentence" in the
// popup. The Web Speech API is stubbed so the spec records what would be
// spoken; `finishSpeaking` plays the end of the last queued utterance.

const READER_SLUG = 'the-cartographer-at-dawn-E2Eread1';

async function stubSpeech(page: Page) {
  await page.addInitScript(() => {
    const spoken: string[] = [];
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
    w.__finishSpeaking = () => last?.onend?.();
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        speak(u: FakeUtterance) {
          spoken.push(u.text);
          last = u;
        },
        cancel() {},
      },
    });
  });
}

const spoken = (page: Page) =>
  page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);

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
