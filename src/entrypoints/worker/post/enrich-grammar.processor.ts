import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import type { PostAiGrammarEnrichmentJobData } from '../../../modules/post/commands/enrich-grammar/enrich-grammar.handler.js';
import { PostPipelineStage } from '../../../modules/post/enums/post-pipeline-stage.enum.js';
import { PostService } from '../../../modules/post/post.service.js';
import { JobWorkerHost, type PipelineStageRef } from '../job-worker-host.js';

@Injectable()
export class EnrichGrammarProcessor extends JobWorkerHost<PostAiGrammarEnrichmentJobData> {
  constructor(private readonly postService: PostService) {
    super();
  }

  protected pipelineStage(
    job: Job<PostAiGrammarEnrichmentJobData>,
  ): PipelineStageRef {
    return {
      stage: PostPipelineStage.GrammarEnrichment,
      postId: job.data.postId,
    };
  }

  protected async processJob(
    job: Job<PostAiGrammarEnrichmentJobData>,
  ): Promise<void> {
    await this.postService.enrichGrammar(job.data.postId);
  }
}
