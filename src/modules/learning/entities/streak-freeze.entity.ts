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

// One UTC calendar day (`YYYY-MM-DD`, same string shape `daily-streak.ts`
// works with) a Premium user has spent a freeze on to keep it counted toward
// their streak despite not reviewing that day. Balance is derived at read
// time from how many rows exist this calendar month — no stored counter,
// same principle as the streak itself (`daily-streak.ts`).
@Entity({ tableName: 'streak_freezes' })
@Unique({ properties: ['userId', 'coveredDate'] })
export class StreakFreeze {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @ManyToOne(() => User, {
    mapToPk: true,
    fieldName: 'user_id',
    deleteRule: 'cascade',
  })
  userId!: string;

  @Property({ type: 'string', length: 10 })
  coveredDate!: string;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();
}
