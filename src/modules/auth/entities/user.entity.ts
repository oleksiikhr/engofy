import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { CefrLevel } from '../../post/enums/cefr-level.enum.js';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'text' })
  @Unique()
  email!: string;

  @Property({ type: 'text', nullable: true })
  @Unique()
  googleSub?: string | null;

  // Self-reported level, changeable by the learner (`PATCH
  // /profile/cefr-level`). Distinct from the derived per-card CEFR breakdown
  // in `ProfileView.cefr`.
  @Enum({ items: () => CefrLevel })
  cefrLevel: Opt<CefrLevel> = CefrLevel.A1;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
