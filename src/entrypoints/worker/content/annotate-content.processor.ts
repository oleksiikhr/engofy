import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import type { ContentAnnotationJobData } from '../../../modules/content/commands/ingest-content/ingest-content.handler.js';
import { ContentService } from '../../../modules/content/content.service.js';
import { JobWorkerHost } from '../job-worker-host.js';

@Injectable()
export class AnnotateContentProcessor extends JobWorkerHost<ContentAnnotationJobData> {
  constructor(private readonly content: ContentService) {
    super();
  }

  protected async processJob(
    job: Job<ContentAnnotationJobData>,
  ): Promise<void> {
    await this.content.annotate(job.data.contentId);
  }
}
