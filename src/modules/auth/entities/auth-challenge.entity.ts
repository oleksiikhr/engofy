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

@Entity({ tableName: 'auth_challenges' })
export class AuthChallenge {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'text' })
  @Unique()
  email!: string;

  @Property({ type: 'text' })
  otpHash!: string;

  @Property({ type: 'smallint', default: 0 })
  attempts: Opt<number> = 0;

  @Property({ type: LuxonTimestampType })
  expiresAt!: DateTime;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();
}
