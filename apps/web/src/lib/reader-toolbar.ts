import {
  type ReaderMode as Mode,
  READER_SIZE_STEPS,
  readPref,
  writePref,
} from './prefs';

// The reader's toolbar: word types (`pos` mode), tenses and Analyze are three
// independent toggles; A- / A+ steps the article's text size. The `data-tok`
// spans are rendered on the server. Enabled modes and the text size are
// persisted through lib/prefs.ts, which mirrors them onto <html> attributes
// set before first paint — app.css styles the modes, their pressed buttons and
// legends from those attributes, so hydration only syncs `aria-pressed` and
// never moves layout.

export function initReaderToolbar(toolbar: HTMLElement): void {
  const enabled = new Set<Mode>(readPref('readerModes'));
  for (const button of toolbar.querySelectorAll<HTMLElement>('[data-mode]')) {
    const mode = button.dataset.mode as Mode;
    button.setAttribute('aria-pressed', String(enabled.has(mode)));
    button.addEventListener('click', () => {
      const on = !enabled.has(mode);
      if (on) {
        enabled.add(mode);
      } else {
        enabled.delete(mode);
      }
      button.setAttribute('aria-pressed', String(on));
      writePref('readerModes', [...enabled]);
    });
  }

  let size = readPref('readerSize');
  const smaller = toolbar.querySelector<HTMLButtonElement>('[data-size="-1"]');
  const larger = toolbar.querySelector<HTMLButtonElement>('[data-size="1"]');
  const applySize = () => {
    if (smaller) {
      smaller.disabled = size === 0;
    }
    if (larger) {
      larger.disabled = size === READER_SIZE_STEPS - 1;
    }
    // An open popup is anchored to text that just reflowed.
    window.dispatchEvent(new Event('resize'));
  };
  const step = (delta: number) => {
    size = Math.min(Math.max(size + delta, 0), READER_SIZE_STEPS - 1);
    writePref('readerSize', size);
    applySize();
  };
  smaller?.addEventListener('click', () => step(-1));
  larger?.addEventListener('click', () => step(1));
  applySize();
}
