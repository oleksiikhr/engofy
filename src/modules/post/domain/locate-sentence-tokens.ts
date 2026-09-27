import {
  type AnalyzableSentenceToken,
  detectVerbGroups,
  type IrregularVerbForms,
  type TokenTense,
  tokenIrregularForms,
  tokenTense,
  type VerbGroupTense,
} from './analyze-token.js';
import { lexicalSpanRanges } from './flatten.js';
import type { IrregularVerbEntry } from './irregular-verb.js';
import {
  type LocatedSentence,
  locateSentenceUnit,
} from './locate-grammar-match.js';
import type { Block } from './node-tree.types.js';
import {
  describeWordRole,
  type WordRoleFallback,
} from './word-role-fallback.js';

export interface LocatedToken {
  // Index within ListBlock.items; null for a paragraph.
  itemIndex: number | null;
  // Half-open char range within the flattened unit's plain text.
  charStart: number;
  charEnd: number;
  pos: string;
  tense: TokenTense | null;
  irregular: IrregularVerbForms | null;
  verbGroup: VerbGroupTense | null;
  // A generic part-of-speech + role description, present only when the token
  // falls outside every `word`/`phrase` span (no dictionary entry to show).
  roleFallback?: WordRoleFallback;
}

// Punctuation and whitespace carry nothing to colour or tag.
const SKIPPED_POS = new Set(['PUNCT', 'SPACE']);

// A sentence's content tokens as char ranges in its block's unit text. Empty
// when the tree was edited after spaCy parsed the sentence.
export function locateSentenceTokens(input: {
  block: Block;
  sentence: LocatedSentence;
  tokens: (AnalyzableSentenceToken & { charStart: number; charEnd: number })[];
  irregularByLemma: Map<string, IrregularVerbEntry>;
}): LocatedToken[] {
  const { block, sentence, tokens, irregularByLemma } = input;
  if (!locateSentenceUnit(block, sentence)) {
    return [];
  }
  const itemIndex = block.type === 'list' ? sentence.unitIndex : null;
  const verbGroupsByPosition = detectVerbGroups(tokens);
  const lexicalRanges = lexicalSpanRanges(block, sentence.unitIndex);
  return tokens
    .filter((token) => !SKIPPED_POS.has(token.pos))
    .map((token) => {
      const charStart = sentence.charStart + token.charStart;
      const charEnd = sentence.charStart + token.charEnd;
      const hasLexiconEntry = lexicalRanges.some(
        (range) => charStart < range.end && charEnd > range.start,
      );
      const roleFallback = hasLexiconEntry
        ? undefined
        : (describeWordRole(token) ?? undefined);
      return {
        itemIndex,
        charStart,
        charEnd,
        pos: token.pos,
        tense: tokenTense(token),
        irregular: tokenIrregularForms(token, irregularByLemma),
        verbGroup: verbGroupsByPosition.get(token.position) ?? null,
        ...(roleFallback ? { roleFallback } : {}),
      };
    });
}
