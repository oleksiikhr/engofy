import {
  type ReaderMode as Mode,
  READER_SIZE_STEPS,
  readPref,
  writePref,
} from './prefs';
import { wrapTokens } from './reader-tokens';
import type { ReaderToken } from './types';

// The reader's toolbar: POS colouring, tense colouring and Analyze are three
// independent toggles (each a class on <body>, styled in app.css); A- / A+
// steps the article's text size. Enabled modes and the text size are persisted
// through lib/prefs.ts; the size is applied by CSS from an <html> attribute
// set before first paint.

export function initReaderToolbar(
  toolbar: HTMLElement,
  root: HTMLElement,
  tokens: ReaderToken[],
): void {
  let wrapped = false;
  const ensureTokens = () => {
    if (!wrapped) {
      wrapped = true;
      wrapTokens(root, tokens);
    }
  };

  const setMode = (mode: Mode, on: boolean) => {
    if (on) {
      ensureTokens();
    }
    document.body.classList.toggle(`reader-${mode}`, on);
    toolbar
      .querySelector(`[data-mode="${mode}"]`)
      ?.setAttribute('aria-pressed', String(on));
    const legend = toolbar.querySelector<HTMLElement>(
      `[data-legend="${mode}"]`,
    );
    if (legend) {
      legend.hidden = !on;
    }
  };

  const enabled = new Set<Mode>(readPref('readerModes'));
  for (const button of toolbar.querySelectorAll<HTMLElement>('[data-mode]')) {
    const mode = button.dataset.mode as Mode;
    if (enabled.has(mode)) {
      setMode(mode, true);
    }
    button.addEventListener('click', () => {
      const on = button.getAttribute('aria-pressed') !== 'true';
      setMode(mode, on);
      if (on) {
        enabled.add(mode);
      } else {
        enabled.delete(mode);
      }
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
