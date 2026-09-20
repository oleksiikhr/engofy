// Plain-text admin alert sent when a post exhausts its pipeline retries.

import { PostPipelineRunStatus } from '../../post/enums/post-pipeline-run-status.enum.js';
import type { PostPipelineStatusView } from '../../post/queries/get-post-pipeline-status/post-pipeline-status-view.js';

const MAX_ERROR_LENGTH = 300;

export function formatFailureAlert(post: PostPipelineStatusView): string {
  const failed = post.stages.find(
    (stage) => stage.status === PostPipelineRunStatus.Failed,
  );
  const lines = [
    `Post failed: ${post.title?.trim() || post.shortId}`,
    `id: ${post.id}`,
  ];
  if (failed) {
    lines.push(`stage: ${failed.stage} (retries: ${failed.retryCount})`);
    if (failed.errorMessage) {
      lines.push(`error: ${truncate(failed.errorMessage)}`);
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
