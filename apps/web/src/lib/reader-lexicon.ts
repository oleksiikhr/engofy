import type { CefrLevel, EffectiveState } from './types';

// Popup content for the reader's word, phrase and grammar labels — shared by
// the client popup (bundled into the page) and the /partials/lexicon-action
// HTMX response, so the action row renders identically before and after a
// save. Output is injected as HTML; interpolated values are escaped.

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};
function esc(value: string): string {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPE[c]);
}

const STATE_LABEL: Record<EffectiveState, string> = {
  new: 'New',
  learning: 'Learning',
  learned: 'Learned',
  skipped: 'Skipped',
};

export const LEXICON_ACTION_MESSAGE = {
  signIn: '<a href="/login">Sign in</a> to save this.',
  deckFull:
    'Free deck is full — <a href="/pricing">go Premium</a> for unlimited cards.',
  failed: 'Could not save, try again.',
} as const;

export type LexiconTarget =
  | { kind: 'word'; id: string }
  | { kind: 'phrase'; id: string }
  | { kind: 'grammar'; id: string };

interface LexiconEntryBase {
  id: string;
  definition: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  state: EffectiveState;
}
export interface WordLexiconEntry extends LexiconEntryBase {
  kind: 'word';
  lemma: string;
  pos: string;
  phonetic: string | null;
}
export interface PhraseLexiconEntry extends LexiconEntryBase {
  kind: 'phrase';
  text: string;
  type: string | null;
}
export type LexiconEntry = WordLexiconEntry | PhraseLexiconEntry;

// A grammar usage point with the construction it belongs to.
export interface GrammarLexiconEntry {
  id: string;
  construction: string;
  cefrLevel: CefrLevel;
  guideword: string;
  canDoStatement: string;
  exampleText: string | null;
  state: EffectiveState;
}

// The new/learning entries of a post, keyed by wordDefinitionId / phraseId /
// grammarUsagePointId — exactly the ones `renderDoc` marks with a span.
export interface LexiconData {
  words: Record<string, WordLexiconEntry>;
  phrases: Record<string, PhraseLexiconEntry>;
  grammar: Record<string, GrammarLexiconEntry>;
}

export function entryTerm(entry: LexiconEntry): string {
  return entry.kind === 'word' ? entry.lemma : entry.text;
}

// The form field (and API body key) carrying each target kind's id.
export const TARGET_FIELD = {
  word: 'wordDefinitionId',
  phrase: 'phraseId',
  grammar: 'grammarUsagePointId',
} as const satisfies Record<LexiconTarget['kind'], string>;

export function lexiconActionsId(target: LexiconTarget): string {
  return `lex-actions-${target.kind}-${target.id}`;
}

// A New target offers both actions; any other state is settled (a card, a
// known or a skip disposition) and shows just its label. `message` is trusted
// HTML from `LEXICON_ACTION_MESSAGE` — never user input.
export function lexiconActionsHtml(
  target: LexiconTarget,
  state: EffectiveState,
  message?: string,
): string {
  const id = lexiconActionsId(target);
  const label = `<span class="lex-state lex-state--${esc(state)}" data-state="${esc(state)}">${esc(STATE_LABEL[state] ?? state)}</span>`;
  const note = message
    ? `<span class="add-card__msg" role="status">${message}</span>`
    : '';

  if (state !== 'new') {
    return `<div class="lex-actions" id="${id}">${label}</div>`;
  }

  const field = TARGET_FIELD[target.kind];
  const form = (action: 'add' | 'known', text: string, extra = '') =>
    `<form hx-post="/partials/lexicon-action" hx-target="#${id}" hx-swap="outerHTML">
      <input type="hidden" name="${field}" value="${esc(target.id)}" />
      <input type="hidden" name="action" value="${action}" />
      <button type="submit" class="btn ${extra}">${text}</button>
    </form>`;

  return `<div class="lex-actions" id="${id}">
    ${label}
    ${form('add', '+')}
    ${form('known', 'I know it', 'btn--ghost')}
    ${note}
  </div>`;
}

function lexiconSectionHtml(entry: LexiconEntry): string {
  const term = entryTerm(entry);
  const sub =
    entry.kind === 'word'
      ? [entry.pos, entry.phonetic].filter(Boolean).join(' · ')
      : (entry.type ?? '');
  const cefr = entry.cefrLevel
    ? `<span class="badge">${esc(entry.cefrLevel)}</span>`
    : '';
  return `<section class="lex-popup__section" data-lex-kind="${entry.kind}" data-lex-id="${esc(entry.id)}">
  <div class="lex-popup__head">
    <span class="lex-popup__term">${esc(term)}</span>
    <button type="button" class="lex-popup__speak" data-speak="${esc(term)}" aria-label="Pronounce ${esc(term)}">🔊</button>
    ${cefr}
  </div>
  ${sub ? `<p class="lex-popup__sub">${esc(sub)}</p>` : ''}
  ${entry.definition ? `<p class="lex-popup__def">${esc(entry.definition)}</p>` : ''}
  ${entry.example ? `<p class="lex-popup__example">${esc(entry.example)}</p>` : ''}
  ${lexiconActionsHtml({ kind: entry.kind, id: entry.id }, entry.state)}
</section>`;
}

function grammarSectionHtml(entry: GrammarLexiconEntry): string {
  return `<section class="lex-popup__section" data-lex-kind="grammar" data-lex-id="${esc(entry.id)}">
  <div class="lex-popup__head">
    <span class="lex-popup__kicker">Grammar · ${esc(entry.construction)}</span>
    <span class="badge">${esc(entry.cefrLevel)}</span>
  </div>
  <p class="lex-popup__term lex-popup__term--guide">${esc(entry.guideword)}</p>
  <p class="lex-popup__def">${esc(entry.canDoStatement)}</p>
  ${entry.exampleText ? `<p class="lex-popup__example">${esc(entry.exampleText)}</p>` : ''}
  ${lexiconActionsHtml({ kind: 'grammar', id: entry.id }, entry.state)}
</section>`;
}

// The popup body: the lexical section on top, the grammar section below it
// (a thin divider between them) when a label carries both.
export function readerPopupHtml(
  lexical: LexiconEntry | null,
  grammar: GrammarLexiconEntry | null,
): string {
  return [
    lexical ? lexiconSectionHtml(lexical) : '',
    grammar ? grammarSectionHtml(grammar) : '',
  ]
    .filter(Boolean)
    .join('<hr class="lex-popup__divider" />');
}
