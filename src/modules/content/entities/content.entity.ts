import type { Opt } from '@mikro-orm/core';
import {
  Embedded,
  Entity,
  Enum,
  PrimaryKey,
  Property,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { ContentSource } from '../embeddables/content-source.embeddable.js';
import { ContentStatus } from '../enums/content-status.enum.js';

@Entity({ tableName: 'contents' })
export class Content {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Embedded(() => ContentSource)
  source!: ContentSource;

  @Property({ type: 'text', nullable: true })
  title?: string | null;

  @Enum({ items: () => ContentStatus })
  status: Opt<ContentStatus> = ContentStatus.Pending;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
