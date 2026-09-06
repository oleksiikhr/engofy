import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import type { PostAiGrammarJobData } from '../../../modules/post/commands/tag-grammar/tag-grammar.handler.js';
import { PostPipelineStage } from '../../../modules/post/enums/post-pipeline-stage.enum.js';
import { PostService } from '../../../modules/post/post.service.js';
import { JobWorkerHost, type PipelineStageRef } from '../job-worker-host.js';

@Injectable()
export class TagGrammarProcessor extends JobWorkerHost<PostAiGrammarJobData> {
  constructor(private readonly postService: PostService) {
    super();
  }

  protected pipelineStage(job: Job<PostAiGrammarJobData>): PipelineStageRef {
    return { stage: PostPipelineStage.AiGrammar, postId: job.data.postId };
  }

  protected async processJob(job: Job<PostAiGrammarJobData>): Promise<void> {
    await this.postService.tagGrammar(job.data.postId);
  }
}
