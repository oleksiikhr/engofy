import { flattenPostPartUnits, type PartUnit } from './flatten.js';
import type { TokenOffsets, TokenRange } from './grammar-span-tokens.js';
import type { Block } from './node-tree.types.js';

export interface LocatedSentence {
  // Which flattened unit of the part the sentence belongs to (Sentence.unitIndex).
  unitIndex: number;
  charStart: number;
  charEnd: number;
  rawText: string;
}

export interface LocatedGrammarMatch {
  // Index within ListBlock.items; null for a paragraph.
  itemIndex: number | null;
  // Half-open char range within the flattened unit's plain text — the same
  // coordinate system as the node tree's text nodes.
  charStart: number;
  charEnd: number;
}

// The flattened unit a sentence belongs to, or null when the unit no longer
// exists or its text at the sentence's offsets differs from `rawText` (the
// tree was edited after spaCy parsed it).
export function locateSentenceUnit(
  block: Block,
  sentence: LocatedSentence,
): PartUnit | null {
  const unit = flattenPostPartUnits(block).find(
    (candidate) => candidate.unitIndex === sentence.unitIndex,
  );
  return unit &&
    unit.text.slice(sentence.charStart, sentence.charEnd) === sentence.rawText
    ? unit
    : null;
}

// Maps a grammar_matches token range (sentence-relative) onto char offsets in
// the flattened unit text of its post part. Returns null when the range covers
// no token, the unit no longer exists, or the unit text at the sentence's
// offsets differs from `rawText` (the tree was edited after spaCy parsed it) —
// the match is then dropped rather than painted on the wrong text.
export function locateGrammarMatch(input: {
  block: Block;
  sentence: LocatedSentence;
  tokens: (TokenOffsets & { position: number })[];
  match: TokenRange;
}): LocatedGrammarMatch | null {
  const { block, sentence, tokens, match } = input;

  const unit = locateSentenceUnit(block, sentence);
  if (!unit) {
    return null;
  }

  const covered = tokens.filter(
    (token) =>
      token.position >= match.tokenStart && token.position < match.tokenEnd,
  );
  if (covered.length === 0) {
    return null;
  }

  return {
    itemIndex: block.type === 'list' ? sentence.unitIndex : null,
    charStart:
      sentence.charStart + Math.min(...covered.map((token) => token.charStart)),
    charEnd:
      sentence.charStart + Math.max(...covered.map((token) => token.charEnd)),
  };
}
