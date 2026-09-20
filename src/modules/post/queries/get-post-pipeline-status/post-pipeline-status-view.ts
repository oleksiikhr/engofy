import type { DateTime } from 'luxon';
import type { PostPipelineRunStatus } from '../../enums/post-pipeline-run-status.enum.js';
import type { PostPipelineStage } from '../../enums/post-pipeline-stage.enum.js';
import type { PostStatus } from '../../enums/post-status.enum.js';

export interface PostStageStatusView {
  stage: PostPipelineStage;
  status: PostPipelineRunStatus;
  retryCount: number;
  // Last failure message for the stage; null when it never failed.
  errorMessage: string | null;
}

export interface PostPipelineStatusView {
  id: string;
  shortId: string;
  title: string | null;
  status: PostStatus;
  createdAt: DateTime;
  // Only stages that have a `post_pipeline_runs` row, in pipeline order.
  stages: PostStageStatusView[];
}

export interface PostPipelineStatusListView {
  items: PostPipelineStatusView[];
}
