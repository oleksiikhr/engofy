import { type ReaderDensity, readPref, writePref } from './prefs';

// The base highlight layer's info row (hint, key, density control). The visual
// state comes from the <html> attributes set before first paint (lib/prefs.ts,
// app.css); hydration only syncs `aria-pressed` and stores the reader's
// choices.

const LABEL_SELECTOR =
  '[data-word-definition-id], [data-phrase-id], [data-grammar-usage-point-id]';

export function initReaderHelp(article: HTMLElement): void {
  // The row's hint gives way to its plain label once the reader has opened the
  // panel or a highlighted label. Both have the same one-line height, so the
  // swap moves nothing.
  const markSeen = () => {
    if (readPref('readerHint') !== 'seen') {
      writePref('readerHint', 'seen');
    }
  };
  const info = article.querySelector<HTMLDetailsElement>('[data-reader-info]');
  info?.addEventListener('toggle', () => {
    if (info.open) {
      markSeen();
    }
  });
  article.querySelector('.reading-body')?.addEventListener('click', (event) => {
    if ((event.target as Element).closest(LABEL_SELECTOR)) {
      markSeen();
    }
  });

  const buttons = article.querySelectorAll<HTMLElement>('[data-density]');
  const sync = (density: ReaderDensity) => {
    for (const button of buttons) {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.density === density),
      );
    }
  };
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const density = button.dataset.density as ReaderDensity;
      writePref('readerDensity', density);
      sync(density);
    });
  }
  sync(readPref('readerDensity'));
}
