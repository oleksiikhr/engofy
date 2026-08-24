import type { Opt } from '@mikro-orm/core';
import {
  Embedded,
  Entity,
  Enum,
  PrimaryKey,
  Property,
  Unique,
} from '@mikro-orm/decorators/legacy';
import { DateTime } from 'luxon';
import { v7 as uuidv7 } from 'uuid';
import { LuxonTimestampType } from '../../../core/database/types/luxon-timestamp.type.js';
import { generateShortId } from '../domain/generate-short-id.js';
import { ContentSource } from '../embeddables/content-source.embeddable.js';
import { ContentStatus } from '../enums/content-status.enum.js';
import { ContentType } from '../enums/content-type.enum.js';

@Entity({ tableName: 'contents' })
export class Content {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Embedded(() => ContentSource)
  source!: ContentSource;

  @Property({ type: 'text', nullable: true })
  title?: string | null;

  @Enum({ items: () => ContentType })
  type: Opt<ContentType> = ContentType.Post;

  // SEO-facing url slug, derived from title at creation time (see
  // generateSlug). Not unique — uniqueness of the public url comes from
  // shortId, so a duplicate title just means a duplicate slug prefix, not a
  // collision. Null when there's no title to derive it from (e.g. a bare
  // quote/comment).
  @Property({ type: 'text', nullable: true })
  slug?: string | null;

  // Short url-facing id, distinct from the uuid primary key — see
  // generateShortId.
  @Property({ type: 'text' })
  @Unique()
  shortId: string = generateShortId();

  @Enum({ items: () => ContentStatus })
  status: Opt<ContentStatus> = ContentStatus.Pending;

  // Mirrors createdAt for now — there's no draft/publish workflow yet, so
  // "published" and "ingested" are the same moment. Kept as its own field
  // (rather than reusing createdAt for JSON-LD `datePublished`) so a real
  // publish step can set it independently once Phase 4 (publishing) lands.
  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  publishedAt: Opt<DateTime> = DateTime.now();

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
