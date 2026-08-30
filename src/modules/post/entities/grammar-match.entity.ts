import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  Index,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';

// A grammar usage point detected in one sentence by the ai_grammar stage.
// tokenStart/tokenEnd are SentenceToken.position offsets (half-open range)
// within that sentence. This is the spaCy-layer counterpart to the
// `grammarConstruct` string on node-tree spans; both coexist (PLAN.md §12).
// The ai_grammar stage deletes a sentence's matches before re-inserting, but a
// partial write + rerun could still double-insert; the composite unique is the
// row-level safety net (stage-run idempotency does not cover it).
@Entity({ tableName: 'grammar_matches' })
@Unique({
  properties: ['sentenceId', 'grammarUsagePointId', 'tokenStart', 'tokenEnd'],
})
export class GrammarMatch {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  // Covered as the leading column of the composite unique above; also the key
  // for the stage's delete-by-sentence.
  @Property({ type: 'uuid' })
  sentenceId!: string;

  @Property({ type: 'uuid' })
  @Index()
  grammarUsagePointId!: string;

  // 0..1 model confidence.
  @Property({ type: 'real', nullable: true })
  confidence?: number | null;

  @Property({ type: 'integer' })
  tokenStart!: number;

  @Property({ type: 'integer' })
  tokenEnd!: number;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
