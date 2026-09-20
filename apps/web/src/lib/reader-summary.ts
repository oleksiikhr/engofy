import { constructionLabel } from './popup-labels';
import type { LexiconData } from './reader-lexicon';
import type { Block, CefrLevel, Doc, PostsListItem } from './types';

// Reading-facing facts about a post: how long it takes, what its level means
// and what the final screen recaps and offers next.

const WORDS_PER_MINUTE = 200;

const SEEN_LIMIT = 8;

export const CEFR_DESCRIPTIONS: Record<CefrLevel, string> = {
  A1: 'Beginner: very short, simple sentences about everyday things.',
  A2: 'Elementary: familiar topics in simple sentences.',
  B1: 'Intermediate: clear text about everyday and familiar topics.',
  B2: 'Upper intermediate: longer text with abstract ideas and less common words.',
  C1: 'Advanced: complex text with implied meaning and idioms.',
  C2: 'Proficiency: near-native text with subtle shades of meaning.',
};

function blockText(block: Block): string {
  const inline =
    block.type === 'list'
      ? block.items.flatMap((item) => item.children)
      : block.children;
  return inline.map((node) => node.text).join('');
}

// Whole minutes, never under one.
export function readingMinutes(doc: Doc): number {
  const words = doc.children
    .map(blockText)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

export interface SeenSummary {
  // Lemmas of the words and phrases still new to the reader, capped.
  words: string[];
  wordsMore: number;
  // Distinct grammar construction names in the text, capped.
  grammar: string[];
  grammarMore: number;
}

function capped(items: string[]): [string[], number] {
  return [items.slice(0, SEEN_LIMIT), Math.max(items.length - SEEN_LIMIT, 0)];
}

// What the text put in front of the reader: new words and phrases, and every
// grammar construction it used.
export function seenSummary(lexicon: LexiconData): SeenSummary {
  const words = [
    ...Object.values(lexicon.words)
      .filter((w) => w.state === 'new')
      .map((w) => w.lemma),
    ...Object.values(lexicon.phrases)
      .filter((p) => p.state === 'new')
      .map((p) => p.text),
  ];
  const grammar = [
    ...new Set(
      Object.values(lexicon.grammar).map((g) =>
        constructionLabel(g.construction),
      ),
    ),
  ];
  const [shownWords, wordsMore] = capped([...new Set(words)]);
  const [shownGrammar, grammarMore] = capped(grammar);
  return {
    words: shownWords,
    wordsMore,
    grammar: shownGrammar,
    grammarMore,
  };
}

// The list is newest-first and already filtered to the post's level, so the
// first entry that is not this post is the next text.
export function pickNextPost(
  items: PostsListItem[],
  currentShortId: string,
): PostsListItem | null {
  return items.find((item) => item.shortId !== currentShortId) ?? null;
}
