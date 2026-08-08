import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import { JobWorkerHost } from '../job-worker-host.js';

export interface ExampleJobData {
  message: string;
}

@Injectable()
export class ExampleProcessor extends JobWorkerHost<ExampleJobData> {
  protected async processJob(job: Job<ExampleJobData>): Promise<void> {
    this.logger.log({ data: job.data }, 'Processing example job');
  }
}
