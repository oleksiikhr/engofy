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

// One of the ~90 grammar constructions (present simple, going to, ...). The
// closed list the ai_grammar stage classifies against. `cheatSheetContent` is
// markdown, including a Form section (affirmative/negative/questions) built
// from the EGP FORM: rows that don't become their own usage points.
@Entity({ tableName: 'grammar_constructions' })
export class GrammarConstruction {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  @Index()
  categoryId!: string;

  @Property({ type: 'text' })
  name!: string;

  @Property({ type: 'text' })
  @Unique()
  slug!: string;

  @Property({ type: 'text', nullable: true })
  cheatSheetContent?: string | null;

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
