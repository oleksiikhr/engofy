import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import { AccountDeletionMailerService } from '../../../modules/auth/services/shared/account-deletion-mailer.service.js';
import { JobWorkerHost } from '../job-worker-host.js';

export interface SendAccountDeletionEmailJobData {
  email: string;
  cancelToken: string;
  scheduledFor: string;
}

@Injectable()
export class SendAccountDeletionEmailProcessor extends JobWorkerHost<SendAccountDeletionEmailJobData> {
  constructor(private readonly mailer: AccountDeletionMailerService) {
    super();
  }

  protected async processJob(
    job: Job<SendAccountDeletionEmailJobData>,
  ): Promise<void> {
    await this.mailer.sendAccountDeletionEmail(job.data);
  }
}
