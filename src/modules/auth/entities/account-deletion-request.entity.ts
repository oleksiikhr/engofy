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

// A learner's request to delete their account after a grace period. Active
// while `cancelledAt` is null; the deletion itself runs later off
// `requestedAt + accountDeletionGraceDays`.
@Entity({ tableName: 'account_deletion_requests' })
export class AccountDeletionRequest {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  @Index()
  userId!: string;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  requestedAt: Opt<DateTime> = DateTime.now();

  // sha256 of the token e-mailed to the learner; lets the cancel link work
  // without a session.
  @Property({ type: 'text' })
  @Unique()
  cancelTokenHash!: string;

  @Property({ type: LuxonTimestampType, nullable: true })
  cancelledAt?: DateTime | null;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
