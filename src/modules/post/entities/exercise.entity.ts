import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  Index,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { ExerciseSource } from '../enums/exercise-source.enum.js';
import { ExerciseType } from '../enums/exercise-type.enum.js';

// An exercise generated from a post. `payload` shape depends on `type`
// (question, options, correct answer, token spans, ...) — kept as jsonb here,
// typed per-type in the exercise domain code (Slice 4).
@Entity({ tableName: 'exercises' })
export class Exercise {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  @Index()
  postId!: string;

  @Enum({ items: () => ExerciseType })
  type!: ExerciseType;

  @Property({ type: 'json' })
  payload!: Record<string, unknown>;

  @Enum({ items: () => ExerciseSource })
  source!: ExerciseSource;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
