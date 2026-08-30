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
import type { Block } from '../domain/node-tree.types.js';
import { PostPartBodyType } from '../domain/post-part-body.type.js';
import { PostPartKind } from '../enums/post-part-kind.enum.js';

// One row per top-level element of Doc.children — a Paragraph or a whole
// ListBlock (all its items, not exploded across rows). This is the
// "top-level block" layer everything else builds on (Lexical/Draft.js-style
// root children), so it's kept deliberately kind-agnostic: no column here is
// specific to any one kind — a list's `ordered` flag and its items all live
// inside `body`, same as any future image/embed/table kind's own fields
// would. Adding a new block kind is a new PostPartKind value + a new
// Block variant in node-tree.types.ts; this table never changes shape for it.
//
// AI annotation still processes one paragraph or one list item per call (see
// PLAN.md's per-unit decision) — that's a call-granularity choice inside the
// annotation job, independent of storage granularity. For a list, each
// item's AI call rewrites this one row's `body.items[i]`, same as any other
// row update; a crash mid-list leaves whatever items were already spliced in
// place (checked the same way: does body.items[i] already contain a span).
@Entity({ tableName: 'post_parts' })
@Unique({ properties: ['postId', 'blockIndex'] })
export class PostPart {
  @PrimaryKey({ type: 'uuid' })
  id: string = uuidv7();

  @Property({ type: 'uuid' })
  postId!: string;

  // Position in Doc.children.
  @Property({ type: 'integer' })
  blockIndex!: number;

  @Enum({ items: () => PostPartKind })
  kind!: PostPartKind;

  // The whole Block (Paragraph or ListBlock, with all its items) for this
  // position in the document.
  @Property({ type: PostPartBodyType })
  body!: Block;

  // Explicit completion marker for post_annotation, not inferred from
  // "does body contain a span" — a paragraph with zero annotate-worthy words
  // is a legitimate, fully-annotated outcome, and inferring completion from
  // span presence would re-call the AI on it forever.
  @Property({ type: LuxonTimestampType, nullable: true })
  annotatedAt?: DateTime | null;

  @Property({ onCreate: () => DateTime.now(), type: LuxonTimestampType })
  createdAt: Opt<DateTime> = DateTime.now();

  @Property({
    onCreate: () => DateTime.now(),
    onUpdate: () => DateTime.now(),
    type: LuxonTimestampType,
  })
  updatedAt: Opt<DateTime> = DateTime.now();
}
