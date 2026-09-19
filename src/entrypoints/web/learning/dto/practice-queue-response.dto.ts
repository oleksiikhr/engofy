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
  // this word/phrase/grammar usage point, or null when none was found there.
  readonly contextSentence!: string | null;

  // Grammar-only: "<category> · <construction>" label above the guideword;
  // null for word/phrase.
  readonly kicker!: string | null;

  // Grammar-only: EGP example sentence; null for word/phrase.
  readonly exampleText!: string | null;

  // Grammar-only: construction slug for the `/grammar/[slug]` detail link;
  // null for word/phrase.
  readonly detailSlug!: string | null;
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

  // Whether the user owns any non-archived card at all, ignoring the type
  // filter and what's due — tells the "no cards yet" empty state apart from
  // "queue cleared" (practice-redesign зріз 4). Always `true` on the daily
  // plan's card list, which has no empty-state UI.
  readonly hasAnyCards!: boolean;
}
