import type { Opt } from '@mikro-orm/core';
import {
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
import { CefrLevel } from '../enums/cefr-level.enum.js';

// The spaCy analysis layer: deterministic sentence segmentation +
// tokenisation, parallel to (not a replacement for) the node-tree annotation
// layer on post_parts (see PLAN.md §12). Anchored to a PostPart's flattened
// plain text so both layers share one coordinate system.
@Entity({ tableName: 'sentences' })
@Unique({ properties: ['postPartId', 'unitIndex', 'position'] })
export class Sentence {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  // Denormalised from post_parts.post_id so post-level reads (feed, CEFR
  // aggregation) don't need a join. Source of truth is postPartId.
  @Property({ type: 'uuid' })
  @Index()
  postId!: string;

  // Covered by the leading column of the composite unique above.
  @Property({ type: 'uuid' })
  postPartId!: string;

  // Which flattened unit within the part: 0 for a paragraph, the list-item
  // index for a list — mirrors flattenDoc's per-unit granularity.
  @Property({ type: 'integer' })
  unitIndex: Opt<number> = 0;

  // Sentence order within its flattened unit.
  @Property({ type: 'integer' })
  position!: number;

  @Property({ type: 'text' })
  rawText!: string;

  // Char offsets of rawText within the flattened unit's plain text.
  @Property({ type: 'integer' })
  charStart!: number;

  @Property({ type: 'integer' })
  charEnd!: number;

  // null until the ai_complexity stage runs (Slice 3).
  @Enum({ items: () => CefrLevel, nullable: true })
  cefrLevel?: CefrLevel | null;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
