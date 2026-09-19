import type { DateTime } from 'luxon';
import type { CardTargetType } from '../../domain/card-target.js';
import type { LearningCardState } from '../../enums/learning-card-state.enum.js';

export interface PracticeCardTarget {
  type: CardTargetType;
  id: string;
  // What the learner sees on the card front (word lemma, phrase text, grammar
  // guideword).
  primary: string;
  // Supporting line: word/phrase definition, or grammar can-do statement.
  secondary: string | null;
  // Word-only (WordDefinition.phonetic); always null for phrase/grammar.
  phonetic: string | null;
  // A real sentence containing this word/phrase, drawn from one of the
  // learner's last 3 distinct read posts (practice-redesign зріз 1) — null
  // when no occurrence is found there. Deliberately no fallback to
  // WordDefinition/Phrase.exampleSentence. Grammar targets don't populate
  // this yet (зріз 3 bridges grammar separately, via grammar_matches).
  contextSentence: string | null;
}

export interface PracticeQueueItem {
  cardId: string;
  state: LearningCardState;
  due: DateTime;
  target: PracticeCardTarget;
}

export interface PracticeQueueResult {
  items: PracticeQueueItem[];
  // How many New-state cards were dropped by the daily new-card cap
  // (practice-redesign зріз 2) — 0 when nothing was held back, or when the
  // caller bypassed the cap. Drives the "N more new cards waiting" UI.
  heldBackNewCount: number;
}
