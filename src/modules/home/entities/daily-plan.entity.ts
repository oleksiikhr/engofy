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
import { LuxonDateType } from '../../../core/database/types/luxon-date.type.js';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { Post } from '../../post/entities/post.entity.js';

// One row per (user, UTC calendar day): the post and grammar highlight
// selected for that day's "Today's session" (PLAN.md daily-session-home
// plan, зріз 1). `postId`/`grammarUsagePointId` are chosen once, at
// find-or-create time, and never reselected for the same day — steps 2-3
// (зрізи 2-3) read them back rather than re-running selection.
@Entity({ tableName: 'daily_plans' })
@Unique({ properties: ['userId', 'planDate'] })
export class DailyPlan {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  userId!: string;

  @Property({ type: LuxonDateType })
  planDate!: DateTime;

  @ManyToOne(() => Post, {
    mapToPk: true,
    fieldName: 'post_id',
    deleteRule: 'cascade',
  })
  postId!: string;

  // FK -> grammar_usage_points.id — null when the chosen post has no
  // still-unlearned grammar usage point to highlight.
  @Property({ type: 'uuid', nullable: true })
  grammarUsagePointId?: string | null;

  // Set by the зріз-3 "complete" endpoint once the linear session finishes.
  @Property({ type: LuxonTimestampType, nullable: true })
  completedAt?: DateTime | null;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();
}
