import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import type { PostAiGrammarJobData } from '../../../modules/post/commands/tag-grammar/tag-grammar.handler.js';
import { PostService } from '../../../modules/post/post.service.js';
import { JobWorkerHost } from '../job-worker-host.js';

@Injectable()
export class TagGrammarProcessor extends JobWorkerHost<PostAiGrammarJobData> {
  constructor(private readonly postService: PostService) {
    super();
  }

  protected async processJob(job: Job<PostAiGrammarJobData>): Promise<void> {
    await this.postService.tagGrammar(job.data.postId);
  }
}
