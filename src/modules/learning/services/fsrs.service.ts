import { Injectable } from '@nestjs/common';
import type { DateTime } from 'luxon';
import { createEmptyCard, type FSRS, fsrs, generatorParameters } from 'ts-fsrs';
import {
  type CardSchedulingState,
  type ReviewLogEntry,
  toFsrsCard,
  toFsrsRating,
  toReviewLogEntry,
  toSchedulingState,
} from '../domain/fsrs-mapping.js';
import type { ReviewRating } from '../enums/review-rating.enum.js';

export interface ScheduledReview {
  card: CardSchedulingState;
  log: ReviewLogEntry;
}

// Wraps ts-fsrs (PLAN.md §3.5). Library defaults — request retention 0.9,
// fuzz on — but with short-term (sub-day) learning steps disabled: for a
// vocab/grammar app the intra-session steps are noise, and skipping them
// keeps the persisted card 1:1 with `learning_cards` (no `learning_steps`
// column). Per-user parameter optimisation is a later concern.
@Injectable()
export class FsrsService {
  private readonly scheduler: FSRS = fsrs(
    generatorParameters({ enable_short_term: false }),
  );

  // Fresh card, due immediately so it enters the practice queue right away.
  newCard(now: DateTime): CardSchedulingState {
    return toSchedulingState(createEmptyCard(now.toJSDate()));
  }

  // Grades `current` and returns the rescheduled card plus the review-log
  // entry to append.
  review(
    current: CardSchedulingState,
    rating: ReviewRating,
    now: DateTime,
  ): ScheduledReview {
    const { card, log } = this.scheduler.next(
      toFsrsCard(current),
      now.toJSDate(),
      toFsrsRating(rating),
    );

    return {
      card: toSchedulingState(card),
      log: toReviewLogEntry(log),
    };
  }
}
