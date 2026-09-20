import { Query } from '@nestjs/cqrs';
import type { PostPipelineStatusListView } from './post-pipeline-status-view.js';

export class GetPostPipelineStatusQuery extends Query<PostPipelineStatusListView> {
  constructor(
    // One post (any status) by uuid, or null for the most recent posts still
    // `processing` or `failed`.
    readonly postId: string | null,
    readonly limit: number,
  ) {
    super();
  }
}
