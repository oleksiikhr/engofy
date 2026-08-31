import type { Post } from '../entities/post.entity.js';
import type { PostSourceFormat } from '../enums/post-source-format.enum.js';
import { PostStatus } from '../enums/post-status.enum.js';

// Plain projection of the freshly-ingested post returned by `IngestPost`.
// A Command must not hand a managed entity back through the bus (cqrs.md Q6);
// callers only need the ids to log / reply / re-query.
export interface IngestedPostView {
  id: string;
  shortId: string;
  status: PostStatus;
  format: PostSourceFormat;
}

export function toIngestedPostView(post: Post): IngestedPostView {
  return {
    id: post.id,
    shortId: post.shortId,
    status: post.status ?? PostStatus.Pending,
    format: post.source.format,
  };
}
