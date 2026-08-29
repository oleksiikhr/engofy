import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import type { PostSpacyParseJobData } from '../../../modules/post/commands/ingest-post/ingest-post.handler.js';
import { PostService } from '../../../modules/post/post.service.js';
import { JobWorkerHost } from '../job-worker-host.js';

@Injectable()
export class SpacyParsePostProcessor extends JobWorkerHost<PostSpacyParseJobData> {
  constructor(private readonly postService: PostService) {
    super();
  }

  protected async processJob(job: Job<PostSpacyParseJobData>): Promise<void> {
    await this.postService.spacyParse(job.data.postId);
  }
}
