import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import type { PostAiComplexityJobData } from '../../../modules/post/commands/assess-complexity/assess-complexity.handler.js';
import { PostService } from '../../../modules/post/post.service.js';
import { JobWorkerHost } from '../job-worker-host.js';

@Injectable()
export class AssessComplexityProcessor extends JobWorkerHost<PostAiComplexityJobData> {
  constructor(private readonly postService: PostService) {
    super();
  }

  protected async processJob(job: Job<PostAiComplexityJobData>): Promise<void> {
    await this.postService.assessComplexity(job.data.postId);
  }
}
