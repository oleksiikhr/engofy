import { Injectable } from '@nestjs/common';
import type { Job } from 'pg-boss';
import { ChallengeMailerService } from '../../../modules/auth/services/shared/challenge-mailer.service.js';
import { JobWorkerHost } from '../job-worker-host.js';

export interface SendChallengeEmailJobData {
  email: string;
  otp: string;
}

@Injectable()
export class SendChallengeEmailProcessor extends JobWorkerHost<SendChallengeEmailJobData> {
  constructor(private readonly challengeMailer: ChallengeMailerService) {
    super();
  }

  protected async processJob(
    job: Job<SendChallengeEmailJobData>,
  ): Promise<void> {
    await this.challengeMailer.sendChallengeEmail(job.data);
  }
}
