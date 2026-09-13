import type { DateTime } from 'luxon';
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
  // SRS card target id (wordDefinitionId / phraseId).
  targetId: string;
  state: LearningCardState;
  // Card due date; the web layer serialises it to ISO-8601 at the edge.
  due: DateTime;
  // Headword: word lemma or phrase text.
  primary: string;
  // Part of speech for a word entry; null for a phrase.
  secondary: string | null;
  definition: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  // Published posts whose text contains this word/phrase (PLAN.md §4
  // `/dictionary`), newest first. Derived from the sentence_tokens
  // word_id / phrase_id links via an indexed join to posts.
  posts: DictionaryPostRefView[];
}

export interface DictionaryView {
  items: DictionaryEntryView[];
}
