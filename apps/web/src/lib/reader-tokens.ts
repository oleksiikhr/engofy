import type { ReaderToken } from './types';

// Client-side token layer for the reader's word-type / tense colouring and
// Analyze mode. Word types are four coloured groups plus `fn` (function
// words), which CSS shows only while the Function words switch is on. Each
// content token is wrapped in a `<span data-tok>` inside the already-rendered
// article — inside word/phrase/grammar labels too, since the wrap only splits
// a text node and never crosses an element boundary. Token offsets are in the
// coordinates of a block unit's plain text, which the DOM text of
// `[data-block]` (a paragraph, or one `li[data-item]`) matches.

const POS_GROUP: Record<string, string> = {
  NOUN: 'noun',
  PROPN: 'noun',
  VERB: 'verb',
  AUX: 'verb',
  ADJ: 'adj',
  ADV: 'adv',
  PRON: 'fn',
  DET: 'fn',
  ADP: 'fn',
  CCONJ: 'fn',
  SCONJ: 'fn',
  PART: 'fn',
  NUM: 'fn',
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

interface TextRun {
  node: Text;
  start: number;
  end: number;
}

function textRuns(unit: Element): TextRun[] {
  const runs: TextRun[] = [];
  const walker = document.createTreeWalker(unit, NodeFilter.SHOW_TEXT);
  let offset = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const length = (node as Text).length;
    runs.push({ node: node as Text, start: offset, end: offset + length });
    offset += length;
  }
  return runs;
}

function unitFor(root: Element, token: ReaderToken): Element | null {
  const block = root.querySelector(`[data-block="${token.blockIndex}"]`);
  return token.itemIndex === null
    ? block
    : (block?.querySelector(`[data-item="${token.itemIndex}"]`) ?? null);
}

function tokenSpan(token: ReaderToken): HTMLSpanElement {
  const span = document.createElement('span');
  span.dataset.tok = '';
  span.dataset.tag = POS_TAG[token.pos] ?? '';
  const group = POS_GROUP[token.pos];
  if (group) {
    span.dataset.posGroup = group;
  }
  if (token.tense) {
    span.dataset.tense = token.tense;
  }
  if (token.irregular) {
    const { base, pastSimple, pastParticiple } = token.irregular;
    span.dataset.irregular = [base, pastSimple[0], pastParticiple[0]].join(
      ' – ',
    );
  }
  return span;
}

// Wraps every token that sits inside a single text node. A token that spans
// several nodes (a mark boundary through a word) is left unwrapped. Within a
// unit tokens are wrapped last-to-first, so splitting a text node never
// shifts the offsets of the tokens still to come.
export function wrapTokens(root: Element, tokens: ReaderToken[]): void {
  const byUnit = new Map<Element, ReaderToken[]>();
  for (const token of tokens) {
    const unit = unitFor(root, token);
    if (unit) {
      byUnit.set(unit, [...(byUnit.get(unit) ?? []), token]);
    }
  }

  for (const [unit, unitTokens] of byUnit) {
    const runs = textRuns(unit);
    const ordered = [...unitTokens].sort((a, b) => b.charStart - a.charStart);
    for (const token of ordered) {
      const run = runs.find(
        (r) => r.start <= token.charStart && token.charEnd <= r.end,
      );
      if (!run) {
        continue;
      }
      const range = document.createRange();
      range.setStart(run.node, token.charStart - run.start);
      range.setEnd(run.node, token.charEnd - run.start);
      range.surroundContents(tokenSpan(token));
    }
  }
}
