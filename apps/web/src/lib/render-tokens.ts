// Server-side token layer for the reader's word-type / tense colouring and
// Analyze mode. `renderDoc` wraps each content token of a block unit (a
// paragraph, or one list item) in a `<span data-tok>` while it renders, so the
// article's geometry is final in the server HTML and hydration never re-flows
// it. Token offsets are in the coordinates of the unit's plain text, which is
// the concatenation of its inline nodes' `text`. A token that crosses a node
// boundary (a mark or link edge through a word) is left unwrapped.

import type { ReaderToken } from './types';

// Word types are four coloured groups; the remaining POS tags get no colour.
const POS_GROUP: Record<string, string> = {
  NOUN: 'noun',
  PROPN: 'noun',
  VERB: 'verb',
  AUX: 'verb',
  ADJ: 'adj',
  ADV: 'adv',
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

export function renderTokenText(
  text: string,
  unit: UnitTokens,
  esc: (value: string) => string,
): string {
  const start = unit.offset;
  const end = start + text.length;
  unit.offset = end;

  let out = '';
  let cursor = 0;
  while (unit.next < unit.tokens.length) {
    const token = unit.tokens[unit.next];
    if (token.charStart >= end) {
      break;
    }
    unit.next++;
    if (
      token.charStart - start < cursor ||
      token.charEnd > end ||
      token.charEnd <= token.charStart
    ) {
      continue;
    }
    out += esc(text.slice(cursor, token.charStart - start));
    out += `${openTag(token, esc)}${esc(text.slice(token.charStart - start, token.charEnd - start))}</span>`;
    cursor = token.charEnd - start;
  }
  return out + esc(text.slice(cursor));
}

function openTag(token: ReaderToken, esc: (value: string) => string): string {
  let attrs = `data-tok data-tag="${esc(POS_TAG[token.pos] ?? '')}"`;
  const group = POS_GROUP[token.pos];
  if (group) {
    attrs += ` data-pos-group="${group}"`;
  }
  if (token.tense) {
    attrs += ` data-tense="${esc(token.tense)}"`;
  }
  if (token.irregular) {
    const { base, pastSimple, pastParticiple } = token.irregular;
    attrs += ` data-irregular="${esc([base, pastSimple[0], pastParticiple[0]].join(' – '))}"`;
  }
  return `<span ${attrs}>`;
}
