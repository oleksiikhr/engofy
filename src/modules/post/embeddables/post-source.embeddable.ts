import type { Opt } from '@mikro-orm/core';
import { Embeddable, Enum, Property } from '@mikro-orm/decorators/legacy';
import { PostSourceFormat } from '../enums/post-source-format.enum.js';
import { PostSourceType } from '../enums/post-source-type.enum.js';

@Embeddable()
export class PostSource {
  @Enum(() => PostSourceFormat)
  format!: PostSourceFormat;

  // How the text relates to its origin (PLAN.md §9). Drives the wording of the
  // attribution line and keeps full-article reposts out of the corpus. The
  // ingest handler always sets this explicitly; the default only covers
  // direct entity construction (tests, seed scripts).
  @Enum(() => PostSourceType)
  type: Opt<PostSourceType> = PostSourceType.Original;

  @Property({ type: 'text' })
  rawText!: string;

  @Property({ type: 'text', nullable: true })
  link?: string | null;

  // Human-readable credit shown on the post page — e.g. "Excerpt from
  // <book>, <author>" or "r/<subreddit> comment". NOT NULL (PLAN.md §9): every
  // post must state where its text came from. The ingest handler derives a
  // concrete value (explicit line -> link -> generic fallback); the default
  // here only covers direct entity construction.
  @Property({ type: 'text' })
  attributionText: Opt<string> = 'Original content';
}
