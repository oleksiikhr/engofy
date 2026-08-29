import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import type { PostAnnotationJobData } from '../../../modules/post/commands/ingest-post/ingest-post.handler.js';
import { PostService } from '../../../modules/post/post.service.js';
import { JobWorkerHost } from '../job-worker-host.js';

@Injectable()
export class AnnotatePostProcessor extends JobWorkerHost<PostAnnotationJobData> {
  constructor(private readonly postService: PostService) {
    super();
  }

  protected async processJob(job: Job<PostAnnotationJobData>): Promise<void> {
    await this.postService.annotate(job.data.postId);
  }
}
