import {
  type GrammarLexiconEntry,
  type LexiconData,
  type LexiconEntry,
  readerPopupHtml,
} from './reader-lexicon';

// Client controller for the reader's anchored popup. One popup element,
// absolutely positioned in document coordinates next to the clicked span
// (above when it fits, else below) — it never takes part in the article's
// flow, so opening it doesn't shift the text. A word/phrase span can sit
// inside a grammar span; clicking it then shows both sections in one popup.

const LEXICAL_SELECTOR = '[data-word-definition-id],[data-phrase-id]';
const GRAMMAR_SELECTOR = '[data-grammar-usage-point-id]';
const LABEL_SELECTOR = `${LEXICAL_SELECTOR},${GRAMMAR_SELECTOR}`;
const LABEL_ATTR: Record<string, string> = {
  word: 'data-word-definition-id',
  phrase: 'data-phrase-id',
  grammar: 'data-grammar-usage-point-id',
};
const GAP = 8;
const EDGE = 8;

interface Target {
  // The span the popup anchors to and marks active.
  anchor: Element;
  lexical: LexiconEntry | null;
  grammar: GrammarLexiconEntry | null;
}

function lexicalEntry(span: Element | null, data: LexiconData) {
  const wordId = span?.getAttribute('data-word-definition-id');
  if (wordId) {
    return data.words[wordId] ?? null;
  }
  const phraseId = span?.getAttribute('data-phrase-id');
  return phraseId ? (data.phrases[phraseId] ?? null) : null;
}

function targetFor(el: Element, data: LexiconData): Target | null {
  if (el.closest('a')) {
    return null;
  }
  const lexicalSpan = el.closest(LEXICAL_SELECTOR);
  const grammarSpan = el.closest(GRAMMAR_SELECTOR);
  const lexical = lexicalEntry(lexicalSpan, data);
  const grammarId = grammarSpan?.getAttribute('data-grammar-usage-point-id');
  const grammar = grammarId ? (data.grammar[grammarId] ?? null) : null;
  const anchor = lexical ? lexicalSpan : grammar ? grammarSpan : null;
  return anchor ? { anchor, lexical, grammar } : null;
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
    'data-grammar-usage-point-id',
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

  // A grammar label cut across several nodes is one wrapper per node; only
  // the first of each is a tab stop.
  const seenGrammar = new Set<string>();
  for (const span of root.querySelectorAll(LABEL_SELECTOR)) {
    const grammarId = span.getAttribute('data-grammar-usage-point-id');
    if (grammarId) {
      if (seenGrammar.has(grammarId)) {
        continue;
      }
      seenGrammar.add(grammarId);
    }
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

  function open(target: Target, clientY: number | null) {
    active?.classList.remove('is-active');
    active = target.anchor;
    anchorY = clientY;
    target.anchor.classList.add('is-active');
    popup.innerHTML = readerPopupHtml(target.lexical, target.grammar);
    if (!('speechSynthesis' in window)) {
      popup.querySelector('.lex-popup__speak')?.remove();
    }
    popup.hidden = false;
    window.htmx?.process(popup);
    position();
  }

  root.addEventListener('click', (event) => {
    const target = targetFor(event.target as Element, data);
    if (target) {
      if (target.anchor === active) {
        close();
      } else {
        open(target, event.clientY);
      }
    }
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    const target = targetFor(event.target as Element, data);
    if (target) {
      event.preventDefault();
      open(target, null);
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

  // An action swaps a section's row in place, which changes the popup's
  // height. Once a target is settled as known/skipped it no longer counts as a
  // label, so every span of it goes back to plain text.
  popup.addEventListener('htmx:afterSwap', () => {
    for (const section of popup.querySelectorAll('[data-lex-kind]')) {
      const state = section
        .querySelector('.lex-state')
        ?.getAttribute('data-state');
      if (state !== 'learned' && state !== 'skipped') {
        continue;
      }
      const attr = LABEL_ATTR[section.getAttribute('data-lex-kind') ?? ''];
      const id = section.getAttribute('data-lex-id') ?? '';
      for (const span of root.querySelectorAll(
        `[${attr}="${CSS.escape(id)}"]`,
      )) {
        unmark(span);
      }
    }
    position();
  });
}
