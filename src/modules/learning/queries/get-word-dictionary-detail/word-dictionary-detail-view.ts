import type { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import type { PartOfSpeech } from '../../../post/enums/part-of-speech.enum.js';
import type { EffectiveState } from '../../domain/resolve-effective-state.js';

export interface WordDictionarySenseView {
  wordDefinitionId: string;
  pos: PartOfSpeech;
  definition: string | null;
  phonetic: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  state: EffectiveState;
  // The active LearningCard backing `state`, when there is one — the
  // "Видалити" action needs it (`DELETE /learning/cards/:cardId`); null for a
  // sense that is New or only carries a disposition (nothing to delete).
  cardId: string | null;
}

export interface WordDictionaryPostView {
  shortId: string;
  slug: string | null;
  title: string | null;
  isRead: boolean;
}

export interface WordDictionaryIrregularFormsView {
  pastSimple: string[];
  pastParticiple: string[];
}

export interface WordDictionaryDetailView {
  lemma: string;
  frequencyRank: number | null;
  irregularVerb: WordDictionaryIrregularFormsView | null;
  // Every WordDefinition sense of this lemma, not only the ones the learner
  // saved — a lemma the learner saved one sense of can still show its other
  // senses as New/CEFR-known.
  senses: WordDictionarySenseView[];
  // Published posts using this word (any sense), newest first; `isRead`
  // splits read/unread on the frontend.
  posts: WordDictionaryPostView[];
}
