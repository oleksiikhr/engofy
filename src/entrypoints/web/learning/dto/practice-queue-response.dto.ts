import type { OffsetPage } from '../../../../core/http/dto/offset-page.js';
import type { CardTargetType } from '../../../../modules/learning/domain/card-target.js';
import type { LearningCardState } from '../../../../modules/learning/enums/learning-card-state.enum.js';

export class PracticeCardTargetDto {
  readonly type!: CardTargetType;

  readonly id!: string;

  // Card front text: word lemma, phrase text, or grammar guideword.
  readonly primary!: string;

  // Supporting line: word/phrase definition, or grammar can-do statement.
  readonly secondary!: string | null;

  // Word-only (WordDefinition.phonetic); null for phrase/grammar.
  readonly phonetic!: string | null;

  // A real sentence from one of the learner's last 3 read posts containing
  // this word/phrase, or null when none was found there. Not populated for
  // grammar targets yet.
  readonly contextSentence!: string | null;
}

export class PracticeQueueItemDto {
  readonly cardId!: string;

  readonly state!: LearningCardState;

  // Due date, ISO-8601.
  readonly due!: string;

  readonly target!: PracticeCardTargetDto;
}

// Shares the `{ items, nextOffset }` envelope with every other list endpoint
// (D14 #36). The queue is capped at `?limit=` with no offset param, so
// `nextOffset` is always `null` — the field is here for wire consistency, not
// because this endpoint paginates.
export class PracticeQueueResponseDto
  implements OffsetPage<PracticeQueueItemDto>
{
  readonly items!: PracticeQueueItemDto[];

  readonly nextOffset!: number | null;

  // How many New-state cards the daily new-card cap held back, 0 when
  // nothing was held back or the cap was bypassed for this request
  // (practice-redesign зріз 2). Drives the "N more new cards waiting" UI.
  readonly heldBackNewCount!: number;
}
