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

// Raw Telegram getUpdates message, stored by the admin-bot cron before it's
// parsed into posts / pipeline reruns. `telegramMessageId` is unique so a
// re-poll of the same update is a no-op (PLAN.md §3.9).
@Entity({ tableName: 'telegram_updates' })
export class TelegramUpdate {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'bigint' })
  @Unique()
  telegramMessageId!: string;

  @Property({ type: 'json' })
  rawPayload!: Record<string, unknown>;

  @Property({ type: 'boolean', default: false })
  processed: Opt<boolean> = false;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();
}
