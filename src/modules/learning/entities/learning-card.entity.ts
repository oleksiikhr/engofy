import type { Opt } from '@mikro-orm/core';
import {
  Check,
  Entity,
  Enum,
  Index,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { LearningCardState } from '../enums/learning-card-state.enum.js';

// One unified SRS card for a word, phrase, or grammar usage point — not three
// tables. Exactly one of the three target FKs is set (CHECK below). FSRS
// scheduling fields map 1:1 to ts-fsrs Card (Slice 6). The free-tier 100-card
// cap is COUNT(*) over this table for a user, with no split by target type
// (PLAN.md §12).
// Postgres treats NULLs as distinct in a unique index, so each of these
// stops a user re-adding a card for the same target without constraining the
// two null FKs a given card always has (PLAN.md §3.5 — one card per target).
@Entity({ tableName: 'learning_cards' })
@Check({
  name: 'learning_cards_exactly_one_target',
  expression:
    '(word_id is not null)::int + (phrase_id is not null)::int + (grammar_usage_point_id is not null)::int = 1',
})
@Unique({ properties: ['userId', 'wordId'] })
@Unique({ properties: ['userId', 'phraseId'] })
@Unique({ properties: ['userId', 'grammarUsagePointId'] })
export class LearningCard {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  @Index()
  userId!: string;

  // FK -> words.id
  @Property({ type: 'uuid', nullable: true })
  wordId?: string | null;

  // FK -> phrases.id
  @Property({ type: 'uuid', nullable: true })
  phraseId?: string | null;

  // FK -> grammar_usage_points.id
  @Property({ type: 'uuid', nullable: true })
  grammarUsagePointId?: string | null;

  // --- FSRS scheduling state (ts-fsrs Card) ---
  @Property({ type: LuxonTimestampType })
  @Index()
  due!: DateTime;

  @Property({ type: 'double' })
  stability!: number;

  @Property({ type: 'double' })
  difficulty!: number;

  @Property({ type: 'integer' })
  elapsedDays!: number;

  @Property({ type: 'integer' })
  scheduledDays!: number;

  @Property({ type: 'integer' })
  reps!: number;

  @Property({ type: 'integer' })
  lapses!: number;

  @Enum({ items: () => LearningCardState })
  state: Opt<LearningCardState> = LearningCardState.New;

  @Property({ type: LuxonTimestampType, nullable: true })
  lastReview?: DateTime | null;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
