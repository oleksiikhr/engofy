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

// One EGP USE / FORM+USE record (~574 of 1239) — the SRS-trackable unit of
// grammar. Pure FORM: records don't land here; they feed the parent
// construction's cheat sheet instead (PLAN.md §12).
@Entity({ tableName: 'grammar_usage_points' })
export class GrammarUsagePoint {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  @Index()
  constructionId!: string;

  // 1-based row number in assets/egp.json — stable natural key the EGP import
  // upserts on. null for a usage point added from a non-EGP source later.
  @Property({ type: 'integer', nullable: true })
  @Unique()
  egpIndex?: number | null;

  @Enum({ items: () => CefrLevel })
  cefrLevel!: CefrLevel;

  // e.g. 'USE: HABITS AND GENERAL FACTS'.
  @Property({ type: 'text' })
  guideword!: string;

  @Property({ type: 'text' })
  canDoStatement!: string;

  @Property({ type: 'text', nullable: true })
  exampleText?: string | null;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
