import type { Opt } from '@mikro-orm/core';
import {
  Entity,
  Enum,
  Index,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { PublicationPlatform } from '../enums/publication-platform.enum.js';
import { PublicationStatus } from '../enums/publication-status.enum.js';

// One post's publication to one external channel. V1 only ever writes
// `telegram` rows; the other platforms exist so the publish stage and this
// schema don't change when they're wired up later (PLAN.md §10).
@Entity({ tableName: 'post_publications' })
@Unique({ properties: ['postId', 'platform'] })
export class PostPublication {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  @Index()
  postId!: string;

  @Enum({ items: () => PublicationPlatform })
  platform!: PublicationPlatform;

  // id of the post on the target platform, once published.
  @Property({ type: 'text', nullable: true })
  externalId?: string | null;

  @Enum({ items: () => PublicationStatus })
  status: Opt<PublicationStatus> = PublicationStatus.Pending;

  @Property({ type: LuxonTimestampType, nullable: true })
  publishedAt?: DateTime | null;

  @Property({ type: 'text', nullable: true })
  errorMessage?: string | null;

  // How many times the telegram publish cron has tried and failed to send this
  // announcement. Bounds the re-send loop for `failed` rows
  // (PublishPendingService); `/retry` resets it to 0.
  @Property({ type: 'int', default: 0 })
  retryCount: Opt<number> = 0;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
