import type { Opt } from '@mikro-orm/core';
import {
  Check,
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { User } from '../../auth/entities/user.entity.js';
import { GrammarUsagePoint } from '../../post/entities/grammar-usage-point.entity.js';
import { Phrase } from '../../post/entities/phrase.entity.js';
import { WordDefinition } from '../../post/entities/word-definition.entity.js';
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
    '(word_definition_id is not null)::int + (phrase_id is not null)::int + (grammar_usage_point_id is not null)::int = 1',
})
@Unique({ properties: ['userId', 'wordDefinitionId'] })
@Unique({ properties: ['userId', 'phraseId'] })
@Unique({ properties: ['userId', 'grammarUsagePointId'] })
// Hot path: the practice queue selects a user's cards ordered by `due`.
@Index({ properties: ['userId', 'due'] })
export class LearningCard {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  // Covered as the leading column of the three composite uniques above and the
  // (userId, due) index.
  @ManyToOne(() => User, {
    mapToPk: true,
    fieldName: 'user_id',
    deleteRule: 'cascade',
  })
  userId!: string;

  // FK -> word_definitions.id (one word sense, not the whole word — a word
  // can have several POS senses, each its own SRS target).
  @ManyToOne(() => WordDefinition, {
    mapToPk: true,
    fieldName: 'word_definition_id',
    deleteRule: 'restrict',
    nullable: true,
  })
  wordDefinitionId?: string | null;

  // FK -> phrases.id
  @ManyToOne(() => Phrase, {
    mapToPk: true,
    fieldName: 'phrase_id',
    deleteRule: 'restrict',
    nullable: true,
  })
  phraseId?: string | null;

  // FK -> grammar_usage_points.id
  @ManyToOne(() => GrammarUsagePoint, {
    mapToPk: true,
    fieldName: 'grammar_usage_point_id',
    deleteRule: 'restrict',
    nullable: true,
  })
  grammarUsagePointId?: string | null;

  // --- FSRS scheduling state (ts-fsrs Card) ---
  // Indexed via the (userId, due) composite above — every due-based read is
  // scoped to one user.
  @Property({ type: LuxonTimestampType })
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

  // Set when the learner removes a card they have already reviewed
  // (`reps > 0`) instead of deleting it outright — keeps FSRS history while
  // taking the card out of the practice queue, dictionary, and free-tier cap.
  // A fresh add for the same target unarchives it rather than creating a new
  // row (RemoveCardHandler / AddCardHandler).
  @Property({ type: LuxonTimestampType, nullable: true })
  archivedAt?: DateTime | null;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
