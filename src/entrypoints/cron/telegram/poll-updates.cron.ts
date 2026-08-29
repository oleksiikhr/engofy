import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PollUpdatesService } from '../../../modules/telegram/services/poll-updates.service.js';
import { CronJobHost } from '../cron-job-host.js';

// PLAN.md §3.9: poll Telegram getUpdates once a minute. No-ops when the bot
// token is unset (local dev).
@Injectable()
export class PollUpdatesCron extends CronJobHost {
  constructor(private readonly pollUpdates: PollUpdatesService) {
    super();
  }

  @Cron('* * * * *', { waitForCompletion: true })
  override async handle(): Promise<void> {
    return super.handle();
  }

  protected async execute(): Promise<void> {
    await this.pollUpdates.run();
  }
}
