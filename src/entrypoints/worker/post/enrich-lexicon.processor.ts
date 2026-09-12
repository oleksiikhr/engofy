import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import type { PostAiEnrichmentJobData } from '../../../modules/post/commands/enrich-lexicon/enrich-lexicon.handler.js';
import { PostPipelineStage } from '../../../modules/post/enums/post-pipeline-stage.enum.js';
import { PostService } from '../../../modules/post/post.service.js';
import { JobWorkerHost, type PipelineStageRef } from '../job-worker-host.js';

@Injectable()
export class EnrichLexiconProcessor extends JobWorkerHost<PostAiEnrichmentJobData> {
  constructor(private readonly postService: PostService) {
    super();
  }

  protected pipelineStage(job: Job<PostAiEnrichmentJobData>): PipelineStageRef {
    return { stage: PostPipelineStage.Enrichment, postId: job.data.postId };
  }

  protected async processJob(job: Job<PostAiEnrichmentJobData>): Promise<void> {
    await this.postService.enrichLexicon(job.data.postId);
  }
}
