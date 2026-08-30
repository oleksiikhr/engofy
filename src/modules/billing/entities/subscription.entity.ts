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
import { SubscriptionPlan } from '../enums/subscription-plan.enum.js';
import { SubscriptionStatus } from '../enums/subscription-status.enum.js';

@Entity({ tableName: 'subscriptions' })
export class Subscription {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  @Index()
  userId!: string;

  @Enum({ items: () => SubscriptionPlan })
  plan!: SubscriptionPlan;

  @Enum({ items: () => SubscriptionStatus })
  status: Opt<SubscriptionStatus> = SubscriptionStatus.Active;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  startedAt: Opt<DateTime> = DateTime.now();

  @Property({ type: LuxonTimestampType })
  currentPeriodEnd!: DateTime;

  // V1 has no real payment provider — the /pricing button just writes a row.
  // When a provider is wired in, add nullable `paymentProvider` /
  // `externalSubscriptionId` columns alongside this (see PLAN.md §8).
  @Property({ type: 'boolean', default: true })
  isMockPayment: Opt<boolean> = true;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
