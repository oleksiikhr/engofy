import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import type { PostPublishJobData } from '../../../modules/post/commands/publish-post/publish-post.handler.js';
import { PostPipelineStage } from '../../../modules/post/enums/post-pipeline-stage.enum.js';
import { PostService } from '../../../modules/post/post.service.js';
import { JobWorkerHost, type PipelineStageRef } from '../job-worker-host.js';

@Injectable()
export class PublishPostProcessor extends JobWorkerHost<PostPublishJobData> {
  constructor(private readonly postService: PostService) {
    super();
  }

  protected pipelineStage(job: Job<PostPublishJobData>): PipelineStageRef {
    return { stage: PostPipelineStage.Publish, postId: job.data.postId };
  }

  protected async processJob(job: Job<PostPublishJobData>): Promise<void> {
    await this.postService.publish(job.data.postId);
  }
}
