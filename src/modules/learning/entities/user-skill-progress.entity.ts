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

// Per-user mastery of one of the ~90 grammar constructions. `masteryScore`
// (0-100) is aggregated from the user's learning_cards whose grammar usage
// point belongs to this construction (PLAN.md §3.6).
@Entity({ tableName: 'user_skill_progress' })
@Unique({ properties: ['userId', 'constructionId'] })
export class UserSkillProgress {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  @Index()
  userId!: string;

  // FK -> grammar_constructions.id
  @Property({ type: 'uuid' })
  constructionId!: string;

  @Property({ type: 'smallint', default: 0 })
  masteryScore: Opt<number> = 0;

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
