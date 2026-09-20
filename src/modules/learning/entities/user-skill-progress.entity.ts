import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  ManyToOne,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { User } from '../../auth/entities/user.entity.js';
import { GrammarConstruction } from '../../post/entities/grammar-construction.entity.js';

// Per-user progress on one of the ~90 grammar constructions: unlock time and
// display-only review tallies. Mastery (0-100) is not stored — `get-profile`
// derives it from the user's learning_cards (PLAN.md §3.6).
@Entity({ tableName: 'user_skill_progress' })
@Unique({ properties: ['userId', 'constructionId'] })
export class UserSkillProgress {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  // Covered as the leading column of the (userId, constructionId) composite
  // unique — every read of this table is scoped to one user.
  @ManyToOne(() => User, {
    mapToPk: true,
    fieldName: 'user_id',
    deleteRule: 'cascade',
  })
  userId!: string;

  // FK -> grammar_constructions.id
  @ManyToOne(() => GrammarConstruction, {
    mapToPk: true,
    fieldName: 'construction_id',
    deleteRule: 'restrict',
  })
  constructionId!: string;

  @Property({ type: 'integer', default: 0 })
  correctStreak: Opt<number> = 0;

  @Property({ type: 'integer', default: 0 })
  totalAttempts: Opt<number> = 0;

  @Property({ type: 'integer', default: 0 })
  correctAttempts: Opt<number> = 0;

  @Property({ type: LuxonTimestampType, nullable: true })
  unlockedAt?: DateTime | null;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
