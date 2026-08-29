import type { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import type { LearningCardState } from '../../enums/learning-card-state.enum.js';

export interface DictionaryPostRefView {
  shortId: string;
  slug: string | null;
  title: string | null;
}

export interface DictionaryEntryView {
  cardId: string;
  type: 'word' | 'phrase';
  // SRS card target id (wordId / phraseId).
  targetId: string;
  state: LearningCardState;
  // ISO-8601.
  due: string;
  // Headword: word lemma or phrase text.
  primary: string;
  // Part of speech for a word entry; null for a phrase.
  secondary: string | null;
  definition: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  // Published posts whose text contains this word/phrase (PLAN.md §4
  // `/dictionary`). Derived from the node-tree spans until a post_word /
  // post_phrase projection exists.
  posts: DictionaryPostRefView[];
}

export interface DictionaryView {
  items: DictionaryEntryView[];
}
