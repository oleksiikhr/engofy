import {
  type LexiconData,
  type LexiconEntry,
  lexiconCardHtml,
} from './reader-lexicon';

// Client controller for the reader's anchored word/phrase popup. One popup
// element, absolutely positioned in document coordinates next to the clicked
// span (above when it fits, else below) — it never takes part in the article's
// flow, so opening it doesn't shift the text.

const SPAN_SELECTOR = '[data-word-definition-id],[data-phrase-id]';
const GAP = 8;
const EDGE = 8;

function entryFor(span: Element, data: LexiconData): LexiconEntry | null {
  const wordId = span.getAttribute('data-word-definition-id');
  if (wordId) {
    return data.words[wordId] ?? null;
  }
  const phraseId = span.getAttribute('data-phrase-id');
  return phraseId ? (data.phrases[phraseId] ?? null) : null;
}

// A span wrapped over several lines has one client rect per line; anchor to
// the line that was clicked, or the first one for keyboard activation.
function anchorRect(span: Element, clientY: number | null): DOMRect {
  const rects = Array.from(span.getClientRects());
  if (clientY !== null) {
    const hit = rects.find((r) => clientY >= r.top && clientY <= r.bottom);
    if (hit) {
      return hit;
    }
  }
  return rects[0] ?? span.getBoundingClientRect();
}

function unmark(span: Element): void {
  for (const attr of [
    'data-word-definition-id',
    'data-phrase-id',
    'tabindex',
    'role',
    'aria-haspopup',
  ]) {
    span.removeAttribute(attr);
  }
  span.classList.remove('is-active');
}

export function initReaderPopup(root: HTMLElement, data: LexiconData): void {
  const popup = document.createElement('div');
  popup.className = 'lex-popup';
  popup.setAttribute('role', 'dialog');
  popup.hidden = true;
  document.body.appendChild(popup);

  let active: Element | null = null;
  let anchorY: number | null = null;

  for (const span of root.querySelectorAll(SPAN_SELECTOR)) {
    span.setAttribute('tabindex', '0');
    span.setAttribute('role', 'button');
    span.setAttribute('aria-haspopup', 'dialog');
  }

  function position(): void {
    if (!active) {
      return;
    }
    const rect = anchorRect(active, anchorY);
    const width = popup.offsetWidth;
    const height = popup.offsetHeight;
    const above = rect.top - height - GAP >= 0;
    const top = above ? rect.top - height - GAP : rect.bottom + GAP;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - width / 2, EDGE),
      Math.max(document.documentElement.clientWidth - width - EDGE, EDGE),
    );
    popup.style.top = `${top + window.scrollY}px`;
    popup.style.left = `${left + window.scrollX}px`;
    popup.dataset.placement = above ? 'above' : 'below';
  }

  function close(): void {
    active?.classList.remove('is-active');
    active = null;
    popup.hidden = true;
  }

  function open(span: Element, entry: LexiconEntry, clientY: number | null) {
    active?.classList.remove('is-active');
    active = span;
    anchorY = clientY;
    span.classList.add('is-active');
    popup.innerHTML = lexiconCardHtml(entry);
    if (!('speechSynthesis' in window)) {
      popup.querySelector('.lex-popup__speak')?.remove();
    }
    popup.hidden = false;
    window.htmx?.process(popup);
    position();
  }

  root.addEventListener('click', (event) => {
    const span = (event.target as Element).closest(SPAN_SELECTOR);
    const entry = span && entryFor(span, data);
    if (span && entry) {
      if (span === active) {
        close();
      } else {
        open(span, entry, event.clientY);
      }
    }
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const span = (event.target as Element).closest(SPAN_SELECTOR);
    const entry = span && entryFor(span, data);
    if (span && entry) {
      event.preventDefault();
      open(span, entry, null);
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (!popup.hidden && !popup.contains(target) && !root.contains(target)) {
      close();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !popup.hidden) {
      const anchor = active;
      close();
      (anchor as HTMLElement | null)?.focus();
    }
  });

  window.addEventListener('resize', position);

  popup.addEventListener('click', (event) => {
    const speak = (event.target as Element).closest('[data-speak]');
    if (speak && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        speak.getAttribute('data-speak') ?? '',
      );
      utterance.lang = 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  });

  // An action swaps the row in place, which changes the popup's height. Once
  // the target is settled as known/skipped it no longer counts as a label, so
  // every span of it goes back to plain text.
  popup.addEventListener('htmx:afterSwap', () => {
    const state = popup.querySelector('.lex-state')?.getAttribute('data-state');
    if (active && (state === 'learned' || state === 'skipped')) {
      const wordId = active.getAttribute('data-word-definition-id');
      const phraseId = active.getAttribute('data-phrase-id');
      const selector = wordId
        ? `[data-word-definition-id="${CSS.escape(wordId)}"]`
        : `[data-phrase-id="${CSS.escape(phraseId ?? '')}"]`;
      for (const span of root.querySelectorAll(selector)) {
        unmark(span);
      }
    }
    position();
  });
}
