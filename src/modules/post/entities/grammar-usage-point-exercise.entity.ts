import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  Index,
  ManyToOne,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { ExerciseType } from '../enums/exercise-type.enum.js';
import { GrammarUsagePoint } from './grammar-usage-point.entity.js';

// A reusable exercise for a usage point, not a post — unlike `Exercise`,
// which is bespoke to one post's sentence. Seeded from assets/grammar-usage-
// -point-exercises.json by `grammar import-usage-point-exercises` (see
// assets/README.md for the seed format); `payload` shape depends on `type`
// (fill_blank/multiple_choice/reorder/find_error — grammar_contrastive never
// appears here, it stays post-bespoke). Ordered for display by `id`
// (uuidv7 sorts by creation time), same as `Exercise`.
@Entity({ tableName: 'grammar_usage_point_exercises' })
export class GrammarUsagePointExercise {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @ManyToOne(() => GrammarUsagePoint, {
    mapToPk: true,
    fieldName: 'usage_point_id',
    deleteRule: 'cascade',
  })
  @Index()
  usagePointId!: string;

  @Enum({ items: () => ExerciseType })
  type!: ExerciseType;

  @Property({ type: 'json' })
  payload!: Record<string, unknown>;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
