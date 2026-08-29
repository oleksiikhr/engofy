import type { DateTime } from 'luxon';
import type { CardTargetType } from '../../domain/card-target.js';
import type { LearningCardState } from '../../enums/learning-card-state.enum.js';

export interface PracticeCardTarget {
  type: CardTargetType;
  id: string;
  // What the learner sees on the card front (word lemma, phrase text, grammar
  // guideword).
  primary: string;
  // Supporting line where one exists (grammar can-do statement); null for
  // words/phrases in V1.
  secondary: string | null;
}

export interface PracticeQueueItem {
  cardId: string;
  state: LearningCardState;
  due: DateTime;
  target: PracticeCardTarget;
}
