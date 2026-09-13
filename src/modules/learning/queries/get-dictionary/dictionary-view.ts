import type { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import type { EffectiveState } from '../../domain/resolve-effective-state.js';

export interface DictionaryPostRefView {
  shortId: string;
  slug: string | null;
  title: string | null;
}

export interface DictionaryEntryView {
  type: 'word' | 'phrase';
  // Headword: word lemma or phrase text. Also the `/dictionary/[lemma]` /
  // `/dictionary/[phrase]` route param — the redesign groups by lemma, so a
  // word entry has no single card/disposition id of its own any more.
  primary: string;
  // The learner's four-state model (learning-foundation §2), computed straight
  // from the merged card/disposition rows below — every entry here already
  // has one or the other, so the CEFR-default tier of `resolveEffectiveState`
  // never applies. For a word with more than one saved sense, this is the
  // "primary" sense's state (see `pickPrimarySense`); the full per-sense
  // breakdown lives on `/dictionary/[lemma]` (зріз 2).
  state: EffectiveState;
  // How many distinct senses (word_definition_id) of this lemma the learner
  // has a card or disposition for. Always 1 for a phrase.
  senseCount: number;
  // Part of speech of the primary sense; null for a phrase.
  secondary: string | null;
  definition: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  // Published posts whose text contains this word/phrase (any saved sense),
  // newest first.
  posts: DictionaryPostRefView[];
}

export interface DictionaryView {
  items: DictionaryEntryView[];
  nextCursor: string | null;
}
