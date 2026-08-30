import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import type { PostAnnotationJobData } from '../../../modules/post/commands/ingest-post/ingest-post.handler.js';
import { PostPipelineStage } from '../../../modules/post/enums/post-pipeline-stage.enum.js';
import { PostService } from '../../../modules/post/post.service.js';
import { JobWorkerHost, type PipelineStageRef } from '../job-worker-host.js';

@Injectable()
export class AnnotatePostProcessor extends JobWorkerHost<PostAnnotationJobData> {
  constructor(private readonly postService: PostService) {
    super();
  }

  protected pipelineStage(job: Job<PostAnnotationJobData>): PipelineStageRef {
    return { stage: PostPipelineStage.Annotation, postId: job.data.postId };
  }

  protected async processJob(job: Job<PostAnnotationJobData>): Promise<void> {
    await this.postService.annotate(job.data.postId);
  }
}
