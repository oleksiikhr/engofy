import { addToGuestDeck, readGuestDeck } from './guest-deck';
import { EXPLORED_EVENT, recordExplored } from './guest-progress';
import { POPUP_LANGS, type PopupLang, readPref, writePref } from './prefs';
import {
  type GrammarLexiconEntry,
  LEXICON_ACTION_MESSAGE,
  type LexiconData,
  type LexiconEntry,
  type LexiconTarget,
  lexiconActionsHtml,
  lexiconActionsId,
  readerPopupHtml,
  SPEAK_ICON,
  TARGET_FIELD,
} from './reader-lexicon';
import { speakSentenceAt } from './reader-listen';
import { speak, speechSupported } from './speech';
import type { EffectiveState } from './types';

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
const ARROW_INSET = 28;

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

function isEffectiveState(value: unknown): value is EffectiveState {
  return (
    value === 'new' ||
    value === 'learning' ||
    value === 'learned' ||
    value === 'skipped'
  );
}

function entriesOf(
  data: LexiconData,
  kind: string,
): Record<string, { state: EffectiveState }> | null {
  if (kind === 'word') {
    return data.words;
  }
  if (kind === 'phrase') {
    return data.phrases;
  }
  return kind === 'grammar' ? data.grammar : null;
}

// A guest's locally saved cards count as Learning, as they will once the
// deck moves into an account.
function applyGuestDeck(data: LexiconData): void {
  for (const { kind, id } of readGuestDeck()) {
    const entry = entriesOf(data, kind)?.[id];
    if (entry?.state === 'new') {
      entry.state = 'learning';
    }
  }
}

function formTarget(form: HTMLFormElement): LexiconTarget | null {
  const fields = new FormData(form);
  for (const kind of Object.keys(TARGET_FIELD) as LexiconTarget['kind'][]) {
    const id = fields.get(TARGET_FIELD[kind]);
    if (typeof id === 'string' && id) {
      return { kind, id };
    }
  }
  return null;
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

export function initReaderPopup(root: HTMLElement, data: LexiconData): void {
  const popup = document.createElement('div');
  popup.className = 'lex-popup';
  popup.setAttribute('role', 'dialog');
  popup.hidden = true;
  document.body.appendChild(popup);

  const slugId =
    root.closest<HTMLElement>('[data-slug-id]')?.dataset.slugId ?? '';
  const isGuest = root.closest('[data-guest]') !== null;
  let active: Element | null = null;
  let current: Target | null = null;
  let anchorY: number | null = null;
  let lang: PopupLang = readPref('popupLang');
  // A guest's "Add to deck" is kept in the browser until they sign in.
  const guest = root.closest('[data-guest]') !== null;
  if (guest) {
    applyGuestDeck(data);
  }

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
    // The arrow points at the anchor, kept clear of the rounded corners.
    const arrow = Math.min(
      Math.max(rect.left + rect.width / 2 - left, ARROW_INSET),
      width - ARROW_INSET,
    );
    popup.style.setProperty('--arrow-x', `${arrow}px`);
    popup.dataset.placement = above ? 'above' : 'below';
  }

  function close(): void {
    active?.classList.remove('is-active');
    active = null;
    popup.hidden = true;
  }

  function render(target: Target): void {
    popup.classList.toggle('tone-amber', target.lexical !== null);
    popup.classList.toggle('tone-blue', target.lexical === null);
    popup.innerHTML = readerPopupHtml(
      target.lexical,
      target.grammar,
      slugId,
      lang,
    );
    if (speechSupported()) {
      popup
        .querySelector('.lex-popup__head')
        ?.insertAdjacentHTML(
          'afterend',
          `<button type="button" class="lex-popup__sentence" data-speak-sentence>${SPEAK_ICON}Read the sentence</button>`,
        );
    } else {
      for (const button of popup.querySelectorAll('[data-speak]')) {
        button.remove();
      }
    }
    popup.hidden = false;
    window.htmx?.process(popup);
    position();
  }

  function open(target: Target, clientY: number | null) {
    active?.classList.remove('is-active');
    active = target.anchor;
    current = target;
    anchorY = clientY;
    target.anchor.classList.add('is-active');
    render(target);
    if (isGuest && target.lexical) {
      const count = recordExplored(
        `${target.lexical.kind}:${target.lexical.id}`,
      );
      document.dispatchEvent(
        new CustomEvent(EXPLORED_EVENT, { detail: count }),
      );
    }
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

  popup.addEventListener(
    'submit',
    (event) => {
      const form = event.target as HTMLFormElement;
      const target = guest ? formTarget(form) : null;
      if (!target || new FormData(form).get('action') !== 'add') {
        return;
      }
      // Stops htmx from sending the guest's add to the server.
      event.preventDefault();
      event.stopImmediatePropagation();
      const saved = addToGuestDeck(target);
      const row = popup.querySelector(`#${lexiconActionsId(target)}`);
      if (row) {
        row.outerHTML = saved
          ? lexiconActionsHtml(target, 'learning', undefined, true)
          : lexiconActionsHtml(
              target,
              'new',
              LEXICON_ACTION_MESSAGE.guestDeckFull,
            );
      }
      syncStates();
    },
    true,
  );

  popup.addEventListener('click', (event) => {
    const langButton = (event.target as Element).closest('[data-popup-lang]');
    const next = langButton?.getAttribute('data-popup-lang');
    if (
      current &&
      (POPUP_LANGS as readonly (string | null | undefined)[]).includes(next)
    ) {
      lang = next as PopupLang;
      writePref('popupLang', lang);
      render(current);
      // The clicked button is gone after the re-render; without this the
      // outside-click handler would see a detached target and close the popup.
      event.stopPropagation();
      return;
    }
    const speakButton = (event.target as Element).closest('[data-speak]');
    if (speakButton) {
      speak(speakButton.getAttribute('data-speak') ?? '');
    } else if (
      active &&
      (event.target as Element).closest('[data-speak-sentence]')
    ) {
      speakSentenceAt(active);
    }
  });

  // An action swaps a section's row in place, which changes the popup's
  // height. The new state is written back to the lexicon data so reopening the
  // label shows it instead of the state the page loaded with. Once a target is
  // settled as known/skipped its spans lose the highlight (`data-known`) but
  // stay clickable.
  function syncStates(): void {
    for (const section of popup.querySelectorAll('[data-lex-kind]')) {
      const state = section
        .querySelector('.lex-state')
        ?.getAttribute('data-state');
      if (!isEffectiveState(state)) {
        continue;
      }
      const kind = section.getAttribute('data-lex-kind') ?? '';
      const id = section.getAttribute('data-lex-id') ?? '';
      const entry = entriesOf(data, kind)?.[id];
      if (entry) {
        entry.state = state;
      }
      const settled = state === 'learned' || state === 'skipped';
      for (const span of root.querySelectorAll(
        `[${LABEL_ATTR[kind]}="${CSS.escape(id)}"]`,
      )) {
        span.toggleAttribute('data-known', settled);
      }
    }
    position();
  }

  popup.addEventListener('htmx:afterSwap', syncStates);
}
