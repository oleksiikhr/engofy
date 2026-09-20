// Plain-text admin replies about a post's pipeline (`/add` confirmation and
// `/status`). Post ids are always the full uuid so they can be pasted straight
// into `/retry` and `/status`.

import { PostPipelineRunStatus } from '../../post/enums/post-pipeline-run-status.enum.js';
import { PostStatus } from '../../post/enums/post-status.enum.js';
import type { PostPipelineStatusView } from '../../post/queries/get-post-pipeline-status/post-pipeline-status-view.js';

const MAX_ERROR_LENGTH = 200;

const STAGE_MARK: Record<PostPipelineRunStatus, string> = {
  [PostPipelineRunStatus.Completed]: '✓',
  [PostPipelineRunStatus.Failed]: '✗',
  [PostPipelineRunStatus.Pending]: '…',
};

export function formatQueuedReply(post: { id: string }): string {
  return [
    `Queued. Post ${post.id} is processing.`,
    `Progress: /status ${post.id}`,
    `Re-run: /retry ${post.id}`,
  ].join('\n');
}

export function formatPostStatuses(
  posts: readonly PostPipelineStatusView[],
  emptyText: string,
): string {
  if (posts.length === 0) {
    return emptyText;
  }
  return posts.map(formatPostStatus).join('\n\n');
}

function formatPostStatus(post: PostPipelineStatusView): string {
  const lines = [
    `${post.title?.trim() || post.shortId} — ${post.status}`,
    `id: ${post.id}`,
  ];
  if (post.stages.length === 0) {
    lines.push('no stages have run yet');
  }
  for (const stage of post.stages) {
    let line = `${STAGE_MARK[stage.status]} ${stage.stage}`;
    if (stage.retryCount > 0) {
      line += ` (retries: ${stage.retryCount})`;
    }
    if (stage.status === PostPipelineRunStatus.Failed && stage.errorMessage) {
      line += `: ${truncate(stage.errorMessage)}`;
    }
    lines.push(line);
  }
  if (post.status === PostStatus.Failed) {
    lines.push(`Re-run: /retry ${post.id}`);
  }
  return lines.join('\n');
}

function truncate(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_ERROR_LENGTH
    ? `${oneLine.slice(0, MAX_ERROR_LENGTH)}…`
    : oneLine;
}
