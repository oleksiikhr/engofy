import type { Opt } from '@mikro-orm/core';
import {
  Check,
  Entity,
  Enum,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { Disposition } from '../enums/disposition.enum.js';

// The learner's known/skipped call on a word sense, phrase, or grammar usage
// point that has no active `learning_cards` row (learning-foundation §2) —
// lower priority than an active card, higher than the CEFR default. Exactly
// one of the three target FKs is set (CHECK below), same pattern as
// `learning_cards`. Keyed by `word_definition_id`, not `word_id`: a
// disposition is a call on one specific sense, so it must not blur two
// definitions of the same word together.
@Entity({ tableName: 'learning_dispositions' })
@Check({
  name: 'learning_dispositions_exactly_one_target',
  expression:
    '(word_definition_id is not null)::int + (phrase_id is not null)::int + (grammar_usage_point_id is not null)::int = 1',
})
@Unique({ properties: ['userId', 'wordDefinitionId'] })
@Unique({ properties: ['userId', 'phraseId'] })
@Unique({ properties: ['userId', 'grammarUsagePointId'] })
export class LearningDisposition {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  userId!: string;

  // FK -> word_definitions.id
  @Property({ type: 'uuid', nullable: true })
  wordDefinitionId?: string | null;

  // FK -> phrases.id
  @Property({ type: 'uuid', nullable: true })
  phraseId?: string | null;

  // FK -> grammar_usage_points.id
  @Property({ type: 'uuid', nullable: true })
  grammarUsagePointId?: string | null;

  @Enum({ items: () => Disposition })
  disposition!: Disposition;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
