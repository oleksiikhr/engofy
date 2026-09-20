import { type ReaderDensity, readPref, writePref } from './prefs';

// The base highlight layer's hint and density control. The visual state comes
// from the <html> attributes set before first paint (lib/prefs.ts, app.css);
// hydration only syncs `aria-pressed` and stores the reader's choices.

export function initReaderHelp(article: HTMLElement): void {
  // Only an explicit dismissal hides the hint: hiding it when a label opens
  // would shift the article under the popup.
  article
    .querySelector('[data-reader-hint-close]')
    ?.addEventListener('click', () => writePref('readerHint', 'seen'));

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
