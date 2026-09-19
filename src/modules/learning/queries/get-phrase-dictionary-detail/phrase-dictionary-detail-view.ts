import type { CefrLevel } from '../../../post/enums/cefr-level.enum.js';
import type { PhraseType } from '../../../post/enums/phrase-type.enum.js';
import type { EffectiveState } from '../../domain/resolve-effective-state.js';

export interface PhraseDictionaryPostView {
  shortId: string;
  slug: string | null;
  title: string | null;
  isRead: boolean;
}

export interface PhraseDictionaryDetailView {
  phraseId: string;
  phraseText: string;
  type: PhraseType | null;
  definition: string | null;
  example: string | null;
  cefrLevel: CefrLevel | null;
  state: EffectiveState;
  // The active LearningCard backing `state`, when there is one — the
  // "Видалити" action needs it (`DELETE /learning/cards/:cardId`); null for a
  // phrase that is New or only carries a disposition (nothing to delete).
  cardId: string | null;
  // Published posts using this phrase, newest first; `isRead` splits
  // read/unread on the frontend.
  posts: PhraseDictionaryPostView[];
}
