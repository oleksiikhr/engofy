import { wrapTokens } from './reader-tokens';
import type { ReaderToken } from './types';

// The reader's toolbar: POS colouring, tense colouring and Analyze are three
// independent toggles (each a class on <body>, styled in app.css); A- / A+
// steps the article's text size. Toggle state is not persisted; the text size
// is, in localStorage.

const MODES = ['pos', 'tense', 'analyze'] as const;
type Mode = (typeof MODES)[number];

const SIZES_REM = [0.95, 1.1, 1.2, 1.35, 1.5, 1.7];
const DEFAULT_SIZE = 2;
const SIZE_KEY = 'reader-size';

function storedSize(): number {
  try {
    const value = Number(localStorage.getItem(SIZE_KEY));
    return Number.isInteger(value) && value >= 0 && value < SIZES_REM.length
      ? value
      : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

function saveSize(size: number): void {
  try {
    localStorage.setItem(SIZE_KEY, String(size));
  } catch {
    // Private mode / blocked storage — the size just isn't remembered.
  }
}

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

  for (const button of toolbar.querySelectorAll<HTMLElement>('[data-mode]')) {
    button.addEventListener('click', () => {
      const mode = button.dataset.mode as Mode;
      setMode(mode, button.getAttribute('aria-pressed') !== 'true');
    });
  }

  let size = storedSize();
  const smaller = toolbar.querySelector<HTMLButtonElement>('[data-size="-1"]');
  const larger = toolbar.querySelector<HTMLButtonElement>('[data-size="1"]');
  const applySize = () => {
    root.style.fontSize = `${SIZES_REM[size]}rem`;
    if (smaller) {
      smaller.disabled = size === 0;
    }
    if (larger) {
      larger.disabled = size === SIZES_REM.length - 1;
    }
    // An open popup is anchored to text that just reflowed.
    window.dispatchEvent(new Event('resize'));
  };
  const step = (delta: number) => {
    size = Math.min(Math.max(size + delta, 0), SIZES_REM.length - 1);
    saveSize(size);
    applySize();
  };
  smaller?.addEventListener('click', () => step(-1));
  larger?.addEventListener('click', () => step(1));
  applySize();
}
