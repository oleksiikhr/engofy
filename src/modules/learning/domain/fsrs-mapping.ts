import { DateTime } from 'luxon';
import {
  type Card as FsrsCard,
  type Grade as FsrsGrade,
  Rating as FsrsRating,
  type ReviewLog as FsrsReviewLog,
  State as FsrsState,
} from 'ts-fsrs';
import { LearningCardState } from '../enums/learning-card-state.enum.js';
import { ReviewRating } from '../enums/review-rating.enum.js';

// The subset of ts-fsrs Card state persisted on `learning_cards` (Luxon +
// text enums instead of ts-fsrs's Date + numeric enums).
export interface CardSchedulingState {
  due: DateTime;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: LearningCardState;
  lastReview: DateTime | null;
}

// The slice of a ts-fsrs ReviewLog kept on `review_logs`.
export interface ReviewLogEntry {
  rating: ReviewRating;
  reviewedAt: DateTime;
  elapsedDays: number;
  scheduledDays: number;
}

const STATE_TO_ENUM: Record<FsrsState, LearningCardState> = {
  [FsrsState.New]: LearningCardState.New,
  [FsrsState.Learning]: LearningCardState.Learning,
  [FsrsState.Review]: LearningCardState.Review,
  [FsrsState.Relearning]: LearningCardState.Relearning,
};

const ENUM_TO_STATE: Record<LearningCardState, FsrsState> = {
  [LearningCardState.New]: FsrsState.New,
  [LearningCardState.Learning]: FsrsState.Learning,
  [LearningCardState.Review]: FsrsState.Review,
  [LearningCardState.Relearning]: FsrsState.Relearning,
};

const RATING_TO_ENUM: Partial<Record<FsrsRating, ReviewRating>> = {
  [FsrsRating.Again]: ReviewRating.Again,
  [FsrsRating.Hard]: ReviewRating.Hard,
  [FsrsRating.Good]: ReviewRating.Good,
  [FsrsRating.Easy]: ReviewRating.Easy,
};

// ReviewRating only carries the four gradeable values, so the mapped result
// is always a ts-fsrs Grade (never Manual).
const ENUM_TO_RATING: Record<ReviewRating, FsrsGrade> = {
  [ReviewRating.Again]: FsrsRating.Again,
  [ReviewRating.Hard]: FsrsRating.Hard,
  [ReviewRating.Good]: FsrsRating.Good,
  [ReviewRating.Easy]: FsrsRating.Easy,
};

export function toFsrsRating(rating: ReviewRating): FsrsGrade {
  return ENUM_TO_RATING[rating];
}

export function ratingFromFsrs(rating: FsrsRating): ReviewRating {
  const mapped = RATING_TO_ENUM[rating];
  if (!mapped) {
    throw new Error(`Unsupported ts-fsrs rating ${rating}`);
  }
  return mapped;
}

// ts-fsrs Card -> persisted state.
export function toSchedulingState(card: FsrsCard): CardSchedulingState {
  return {
    due: DateTime.fromJSDate(card.due),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_TO_ENUM[card.state],
    lastReview: card.last_review ? DateTime.fromJSDate(card.last_review) : null,
  };
}

// Persisted state -> ts-fsrs Card (for the next scheduling call).
// `learning_steps` is not persisted — FsrsService runs with short-term
// steps disabled, so it is always 0.
export function toFsrsCard(state: CardSchedulingState): FsrsCard {
  return {
    due: state.due.toJSDate(),
    stability: state.stability,
    difficulty: state.difficulty,
    elapsed_days: state.elapsedDays,
    scheduled_days: state.scheduledDays,
    learning_steps: 0,
    reps: state.reps,
    lapses: state.lapses,
    state: ENUM_TO_STATE[state.state],
    last_review: state.lastReview ? state.lastReview.toJSDate() : undefined,
  };
}

export function toReviewLogEntry(log: FsrsReviewLog): ReviewLogEntry {
  return {
    rating: ratingFromFsrs(log.rating),
    reviewedAt: DateTime.fromJSDate(log.review),
    elapsedDays: log.elapsed_days,
    scheduledDays: log.scheduled_days,
  };
}
