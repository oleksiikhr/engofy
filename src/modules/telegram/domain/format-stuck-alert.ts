// Plain-text admin alert sent when a `processing` post has gone idle.

import { PostPipelineRunStatus } from '../../post/enums/post-pipeline-run-status.enum.js';
import type { PostPipelineStatusView } from '../../post/queries/get-post-pipeline-status/post-pipeline-status-view.js';

const MAX_ERROR_LENGTH = 300;

export function formatStuckAlert(
  post: PostPipelineStatusView,
  idleMinutes: number,
): string {
  // The stage the pipeline is waiting on: the first one not yet completed,
  // else the last one that ran (all done but the post never published).
  const current =
    post.stages.find(
      (stage) => stage.status !== PostPipelineRunStatus.Completed,
    ) ?? post.stages.at(-1);
  const lines = [
    `Post stuck: ${post.title?.trim() || post.shortId}`,
    `id: ${post.id}`,
    `idle: ${idleMinutes} min`,
  ];
  if (current) {
    lines.push(
      `stage: ${current.stage} (${current.status}, retries: ${current.retryCount})`,
    );
    if (current.errorMessage) {
      lines.push(`error: ${truncate(current.errorMessage)}`);
    }
  }
  lines.push(`Status: /status ${post.id}`, `Re-run: /retry ${post.id}`);
  return lines.join('\n');
}

function truncate(text: string): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_ERROR_LENGTH
    ? `${oneLine.slice(0, MAX_ERROR_LENGTH)}…`
    : oneLine;
}
