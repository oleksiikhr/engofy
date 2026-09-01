import type { OffsetPage } from '../../../../core/http/dto/offset-page.js';
import type { CardTargetType } from '../../../../modules/learning/domain/card-target.js';
import type { LearningCardState } from '../../../../modules/learning/enums/learning-card-state.enum.js';

export class PracticeCardTargetDto {
  readonly type!: CardTargetType;

  readonly id!: string;

  // Card front text: word lemma, phrase text, or grammar guideword.
  readonly primary!: string;

  // Supporting line (grammar can-do statement) or null.
  readonly secondary!: string | null;
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
}
