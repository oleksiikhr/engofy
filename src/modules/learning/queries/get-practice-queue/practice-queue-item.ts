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
  // A real sentence containing this word/phrase/grammar usage point, drawn
  // from one of the learner's last 3 distinct read posts (practice-redesign
  // зріз 1 for word/phrase via the node tree, зріз 3 for grammar via
  // `grammar_matches`) — null when no occurrence is found there. Deliberately
  // no fallback to WordDefinition/Phrase.exampleSentence.
  contextSentence: string | null;
  // Grammar-only (practice-redesign зріз 3): "<category> · <construction>"
  // label shown above the guideword. null for word/phrase, or when the usage
  // point's construction/category row is missing.
  kicker: string | null;
  // Grammar-only: EGP example sentence (GrammarUsagePoint.exampleText).
  exampleText: string | null;
  // Grammar-only: the construction's slug, for the "Детальніше" link to
  // `/grammar/[slug]`. null for word/phrase, or when the construction is
  // missing.
  detailSlug: string | null;
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
  // Whether the user owns any non-archived card at all, regardless of the
  // type filter or what's due — separates the "no cards ever" empty state
  // from "queue cleared" (practice-redesign зріз 4).
  hasAnyCards: boolean;
}
