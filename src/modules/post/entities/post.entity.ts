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
import { PostSource } from '../embeddables/post-source.embeddable.js';
import { CefrLevel } from '../enums/cefr-level.enum.js';
import { PostStatus } from '../enums/post-status.enum.js';
import { PostType } from '../enums/post-type.enum.js';

@Entity({ tableName: 'posts' })
export class Post {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Embedded(() => PostSource)
  source!: PostSource;

  @Property({ type: 'text', nullable: true })
  title?: string | null;

  @Enum({ items: () => PostType })
  type: Opt<PostType> = PostType.Post;

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

  @Enum({ items: () => PostStatus })
  status: Opt<PostStatus> = PostStatus.Pending;

  // Overall CEFR level of the post text; null until the ai_complexity stage
  // runs (PLAN.md §5). Per-sentence levels live on `sentences.cefr_level`.
  @Enum({ items: () => CefrLevel, nullable: true })
  cefrLevel?: CefrLevel | null;

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
