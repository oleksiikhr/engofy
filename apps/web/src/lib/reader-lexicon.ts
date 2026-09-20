import {
  constructionLabel,
  guidewordLabel,
  phraseTypeLabel,
  posLabel,
  shortExample,
} from './popup-labels';
import { type PopupLang, TRANSLATION_LANGS } from './prefs';
import type {
  CefrLevel,
  EffectiveState,
  GrammarTranslations,
  LexiconTranslations,
  TranslationLang,
} from './types';

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

const PLUS_ICON =
  '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const SPEAK_ICON =
  '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/></svg>';

export type LexiconTarget =
  | { kind: 'word'; id: string }
  | { kind: 'phrase'; id: string }
  | { kind: 'grammar'; id: string };

interface LexiconEntryBase {
  id: string;
  definition: string | null;
  example: string | null;
  translations: LexiconTranslations;
  cefrLevel: CefrLevel | null;
  state: EffectiveState;
}
export interface WordLexiconEntry extends LexiconEntryBase {
  kind: 'word';
  lemma: string;
  pos: string;
  phonetic: string | null;
  frequencyRank: number | null;
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
  explanation: string | null;
  translations: GrammarTranslations;
  examples: string[];
  // "Why this construction, not a competing one" — shown in Analyze mode.
  contrast: string | null;
  state: EffectiveState;
}

// The entries of a post, keyed by wordDefinitionId / phraseId /
// grammarUsagePointId — exactly the ones `renderDoc` labels with a span.
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
      <button type="submit" class="btn btn--sm ${extra}">${text}</button>
    </form>`;

  return `<div class="lex-actions" id="${id}">
    ${label}
    ${form('add', `${PLUS_ICON}Add to deck`)}
    ${form('known', 'I know it', 'btn--sec')}
    ${note}
  </div>`;
}

export function reportRowId(target: LexiconTarget): string {
  return `lex-report-${target.kind}-${target.id}`;
}

// "Report a mistake" — posts the label to /partials/report-label, which swaps
// this row for a thanks note.
export function reportRowHtml(target: LexiconTarget, slugId: string): string {
  return `<div class="lex-report" id="${reportRowId(target)}">
    <form hx-post="/partials/report-label" hx-target="#${reportRowId(target)}" hx-swap="outerHTML">
      <input type="hidden" name="slugId" value="${esc(slugId)}" />
      <input type="hidden" name="kind" value="${target.kind}" />
      <input type="hidden" name="targetId" value="${esc(target.id)}" />
      <button type="submit" class="lex-report__btn">Report a mistake</button>
    </form>
  </div>`;
}

export const REPORT_DONE_HTML =
  '<span class="lex-report lex-report--done" role="status">Thanks — reported.</span>';

const LANG_LABEL: Record<PopupLang, string> = { en: 'EN', uk: 'УКР' };

// The translation languages some section on screen has text for.
function availableLangs(
  lexical: LexiconEntry | null,
  grammar: GrammarLexiconEntry | null,
): TranslationLang[] {
  return TRANSLATION_LANGS.filter(
    (code) => lexical?.translations[code] || grammar?.translations[code],
  );
}

// The EN / УКР switch for the popup's definitions. Only offered when some
// section on screen has a translation to show.
function langToggleHtml(lang: PopupLang, langs: TranslationLang[]): string {
  const button = (value: PopupLang) =>
    `<button type="button" class="lex-popup__lang-btn" data-popup-lang="${value}" aria-pressed="${lang === value}">${LANG_LABEL[value]}</button>`;
  return `<div class="lex-popup__lang" role="group" aria-label="Definition language">${['en' as const, ...langs].map(button).join('')}</div>`;
}

function topRowHtml(kicker: string, toggle: string): string {
  return `<div class="lex-popup__top"><p class="lex-popup__kicker">${esc(kicker)}</p>${toggle}</div>`;
}

function lexiconSectionHtml(
  entry: LexiconEntry,
  slugId: string,
  lang: PopupLang,
  toggle: string,
): string {
  const term = entryTerm(entry);
  const kicker =
    entry.kind === 'word'
      ? ['Word', posLabel(entry.pos)].filter(Boolean).join(' · ')
      : ['Phrase', phraseTypeLabel(entry.type)].filter(Boolean).join(' · ');
  const sub = entry.kind === 'word' ? (entry.phonetic ?? '') : '';
  const translation =
    lang === 'en' ? null : entry.translations[lang]?.translation;
  const cefr = entry.cefrLevel
    ? `<span class="badge">${esc(entry.cefrLevel)}</span>`
    : '';
  return `<section class="lex-popup__section tone-amber" data-lex-kind="${entry.kind}" data-lex-id="${esc(entry.id)}">
  ${topRowHtml(kicker, toggle)}
  <div class="lex-popup__head">
    <span class="lex-popup__term">${esc(term)}</span>
    ${cefr}
    <button type="button" class="lex-popup__speak" data-speak="${esc(term)}" aria-label="Pronounce ${esc(term)}">${SPEAK_ICON}</button>
  </div>
  ${sub ? `<p class="lex-popup__sub">${esc(sub)}</p>` : ''}
  ${translation ? `<p class="lex-popup__translation" lang="${esc(lang)}">${esc(translation)}</p>` : ''}
  ${entry.definition ? `<p class="lex-popup__def">${esc(entry.definition)}</p>` : ''}
  ${entry.example ? `<p class="lex-popup__example">${esc(shortExample(entry.example))}</p>` : ''}
  ${lexiconActionsHtml({ kind: entry.kind, id: entry.id }, entry.state)}
  ${reportRowHtml({ kind: entry.kind, id: entry.id }, slugId)}
</section>`;
}

function grammarSectionHtml(
  entry: GrammarLexiconEntry,
  slugId: string,
  lang: PopupLang,
  toggle: string,
): string {
  const guideword = guidewordLabel(entry.guideword);
  const translated =
    lang === 'en' ? null : entry.translations[lang]?.explanation;
  const explanation = translated
    ? `<p class="lex-popup__def" lang="${esc(lang)}">${esc(translated)}</p>`
    : `<p class="lex-popup__def">${esc(entry.explanation ?? entry.canDoStatement)}</p>`;
  return `<section class="lex-popup__section tone-blue" data-lex-kind="grammar" data-lex-id="${esc(entry.id)}">
  ${topRowHtml('Grammar', toggle)}
  <div class="lex-popup__head">
    <span class="lex-popup__term">${esc(constructionLabel(entry.construction))}</span>
    <span class="badge">${esc(entry.cefrLevel)}</span>
  </div>
  ${guideword ? `<p class="lex-popup__sub">${esc(guideword)}</p>` : ''}
  ${explanation}
  ${entry.examples[0] ? `<p class="lex-popup__example">${esc(shortExample(entry.examples[0]))}</p>` : ''}
  ${entry.contrast ? `<p class="lex-popup__contrast"><b>Why this, not another form?</b> ${esc(entry.contrast)}</p>` : ''}
  ${lexiconActionsHtml({ kind: 'grammar', id: entry.id }, entry.state)}
  ${reportRowHtml({ kind: 'grammar', id: entry.id }, slugId)}
</section>`;
}

// The popup body: the lexical section on top, the grammar section below it
// (a thin divider between them) when a label carries both. The language
// switch sits in the first section's top row.
export function readerPopupHtml(
  lexical: LexiconEntry | null,
  grammar: GrammarLexiconEntry | null,
  slugId: string,
  lang: PopupLang,
): string {
  const langs = availableLangs(lexical, grammar);
  const toggle = langs.length > 0 ? langToggleHtml(lang, langs) : '';
  return [
    lexical ? lexiconSectionHtml(lexical, slugId, lang, toggle) : '',
    grammar
      ? grammarSectionHtml(grammar, slugId, lang, lexical ? '' : toggle)
      : '',
  ]
    .filter(Boolean)
    .join('<hr class="lex-popup__divider" />');
}
