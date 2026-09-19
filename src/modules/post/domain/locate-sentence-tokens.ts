import {
  type AnalyzableToken,
  type IrregularVerbForms,
  type TokenTense,
  tokenIrregularForms,
  tokenTense,
} from './analyze-token.js';
import type { IrregularVerbEntry } from './irregular-verb.js';
import {
  type LocatedSentence,
  locateSentenceUnit,
} from './locate-grammar-match.js';
import type { Block } from './node-tree.types.js';

export interface LocatedToken {
  // Index within ListBlock.items; null for a paragraph.
  itemIndex: number | null;
  // Half-open char range within the flattened unit's plain text.
  charStart: number;
  charEnd: number;
  pos: string;
  tense: TokenTense | null;
  irregular: IrregularVerbForms | null;
}

// Punctuation and whitespace carry nothing to colour or tag.
const SKIPPED_POS = new Set(['PUNCT', 'SPACE']);

// A sentence's content tokens as char ranges in its block's unit text. Empty
// when the tree was edited after spaCy parsed the sentence.
export function locateSentenceTokens(input: {
  block: Block;
  sentence: LocatedSentence;
  tokens: (AnalyzableToken & { charStart: number; charEnd: number })[];
  irregularByLemma: Map<string, IrregularVerbEntry>;
}): LocatedToken[] {
  const { block, sentence, tokens, irregularByLemma } = input;
  if (!locateSentenceUnit(block, sentence)) {
    return [];
  }
  const itemIndex = block.type === 'list' ? sentence.unitIndex : null;
  return tokens
    .filter((token) => !SKIPPED_POS.has(token.pos))
    .map((token) => ({
      itemIndex,
      charStart: sentence.charStart + token.charStart,
      charEnd: sentence.charStart + token.charEnd,
      pos: token.pos,
      tense: tokenTense(token),
      irregular: tokenIrregularForms(token, irregularByLemma),
    }));
}
