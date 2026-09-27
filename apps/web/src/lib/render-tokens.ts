// Server-side token layer for the reader's word-type / tense colouring and
// Analyze mode. `renderDoc` wraps each content token of a block unit (a
// paragraph, or one list item) in a `<span data-tok>` while it renders, so the
// article's geometry is final in the server HTML and hydration never re-flows
// it. Token offsets are in the coordinates of the unit's plain text, which is
// the concatenation of its inline nodes' `text`. A token that crosses a node
// boundary (a mark or link edge through a word) is left unwrapped.

import { tenseAspectLabel } from './popup-labels';
import type { ReaderToken, TokenVerbGroup } from './types';

// Word types: four content-word colours, plus a fifth, visually muted group
// for every function word — every content token ends up with a visible
// category, not just noun/verb/adj/adv.
const POS_GROUP: Record<string, string> = {
  NOUN: 'noun',
  PROPN: 'noun',
  VERB: 'verb',
  AUX: 'verb',
  ADJ: 'adj',
  ADV: 'adv',
  PRON: 'function',
  DET: 'function',
  ADP: 'function',
  CCONJ: 'function',
  SCONJ: 'function',
  PART: 'function',
  NUM: 'function',
  INTJ: 'function',
};

// Short label shown under a token in Analyze mode.
const POS_TAG: Record<string, string> = {
  NOUN: 'noun',
  PROPN: 'proper',
  VERB: 'verb',
  AUX: 'aux',
  ADJ: 'adj',
  ADV: 'adv',
  PRON: 'pron',
  DET: 'det',
  ADP: 'prep',
  CCONJ: 'conj',
  SCONJ: 'conj',
  PART: 'part',
  NUM: 'num',
  INTJ: 'interj',
};

// A verb group's tense+aspect, abbreviated to fit the Analyze caption's one
// short line — replaces the bare "verb"/"aux" tag with the more useful "why
// this form" info, and is what makes "had" and "drawn" read alike.
const TENSE_ABBR: Record<TokenVerbGroup['tense'], string> = {
  past: 'past',
  present: 'pres',
  future: 'fut',
};
const ASPECT_ABBR: Partial<Record<TokenVerbGroup['aspect'], string>> = {
  continuous: 'cont',
  perfect: 'perf',
  perfectContinuous: 'perf cont',
};
function verbGroupTag(group: TokenVerbGroup): string {
  const aspect = ASPECT_ABBR[group.aspect];
  return aspect
    ? `${TENSE_ABBR[group.tense]} ${aspect}`
    : TENSE_ABBR[group.tense];
}

// Tokens of one block unit in reading order, consumed as its text nodes are
// rendered.
export interface UnitTokens {
  tokens: ReaderToken[];
  next: number;
  // Plain-text offset of the next text node.
  offset: number;
}

export function unitKey(blockIndex: number, itemIndex: number | null): string {
  return `${blockIndex}:${itemIndex ?? ''}`;
}

export function groupTokens(tokens: ReaderToken[]): Map<string, ReaderToken[]> {
  const byUnit = new Map<string, ReaderToken[]>();
  for (const token of tokens) {
    const key = unitKey(token.blockIndex, token.itemIndex);
    byUnit.set(key, [...(byUnit.get(key) ?? []), token]);
  }
  for (const list of byUnit.values()) {
    list.sort((a, b) => a.charStart - b.charStart);
  }
  return byUnit;
}

export function unitTokens(tokens: ReaderToken[] = []): UnitTokens {
  return { tokens, next: 0, offset: 0 };
}

// spaCy splits "It's", "don't" and a possessive "farmers'" into a head token
// plus a clitic; the clitic is part of the same written word.
const CLITIC = /^(?:['’](?:s|re|ve|ll|d|m|t)?|n['’]t)$/i;

export function renderTokenText(
  text: string,
  unit: UnitTokens,
  esc: (value: string) => string,
): string {
  const start = unit.offset;
  const end = start + text.length;
  unit.offset = end;

  // A clitic that directly follows its head token is rendered inside the
  // head's span when both sit in this node, and as plain text otherwise, so a
  // word is never split into two token spans.
  const spans: { from: number; to: number; token: ReaderToken }[] = [];
  let cursor = 0;
  while (unit.next < unit.tokens.length) {
    const token = unit.tokens[unit.next];
    if (token.charStart >= end) {
      break;
    }
    const previous = unit.tokens[unit.next - 1];
    unit.next++;
    const from = token.charStart - start;
    const to = token.charEnd - start;
    if (
      from < cursor ||
      token.charEnd > end ||
      token.charEnd <= token.charStart
    ) {
      continue;
    }
    if (
      previous?.charEnd === token.charStart &&
      CLITIC.test(text.slice(from, to))
    ) {
      const head = spans.at(-1);
      if (head && head.to === from) {
        head.to = to;
        cursor = to;
      }
      continue;
    }
    spans.push({ from, to, token });
    cursor = to;
  }

  let out = '';
  cursor = 0;
  for (const { from, to, token } of spans) {
    out += esc(text.slice(cursor, from));
    out += `${openTag(token, esc)}${esc(text.slice(from, to))}</span>`;
    cursor = to;
  }
  return out + esc(text.slice(cursor));
}

function openTag(token: ReaderToken, esc: (value: string) => string): string {
  // A verb-group member's Analyze caption is its tense+aspect (more useful
  // than the bare "verb"/"aux" tag); everything else falls back to the raw
  // UPOS tag when it isn't one of the curated POS_TAG labels, so every
  // content token gets some caption.
  const tag = token.verbGroup
    ? verbGroupTag(token.verbGroup)
    : (POS_TAG[token.pos] ?? token.pos.toLowerCase());
  let attrs = `data-tok data-tag="${esc(tag)}"`;
  const group = POS_GROUP[token.pos];
  if (group) {
    attrs += ` data-pos-group="${group}"`;
  }
  // The whole verb-group aux chain shares one tense ("had" and "drawn" both
  // read as past), not just the finite token `token.tense` alone covers.
  const tense = token.verbGroup?.tense ?? token.tense;
  if (tense) {
    attrs += ` data-tense="${esc(tense)}"`;
  }
  if (token.verbGroup) {
    attrs += ` data-aspect="${esc(token.verbGroup.aspect)}" data-tense-label="${esc(tenseAspectLabel(token.verbGroup))}"`;
  }
  if (token.irregular) {
    const { base, pastSimple, pastParticiple } = token.irregular;
    attrs += ` data-irregular="${esc([base, pastSimple[0], pastParticiple[0]].join(' – '))}"`;
  }
  // A token with no word/phrase span still opens a click popup, off this
  // fallback (reader-popup.ts's `targetFor`) — tabindex/role go straight on
  // the token span since it has no other wrapper to carry them.
  if (token.roleFallback) {
    attrs += ` data-pos-label="${esc(token.roleFallback.posLabel)}" data-role-hint="${esc(token.roleFallback.roleHint)}" tabindex="0" role="button" aria-haspopup="dialog"`;
  }
  return `<span ${attrs}>`;
}
