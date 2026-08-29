import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';

// One of the ~19 top-level Cambridge English Grammar Profile categories
// (PRESENT, MODALITY, PASSIVES, ...). Seeded by the EGP import CLI (Slice 1).
@Entity({ tableName: 'grammar_categories' })
export class GrammarCategory {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'text' })
  @Unique()
  name!: string;

  @Property({ type: 'integer' })
  sortOrder!: number;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
