import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PublishPendingService } from '../../../modules/telegram/services/shared/publish-pending.service.js';
import { CronJobHost } from '../cron-job-host.js';

// PLAN.md §3.8: drain `pending` telegram post_publications once a minute.
// No-ops when the bot token or channel id is unset.
@Injectable()
export class PublishPendingCron extends CronJobHost {
  constructor(private readonly publishPending: PublishPendingService) {
    super();
  }

  @Cron('* * * * *', { waitForCompletion: true })
  override async handle(): Promise<void> {
    return super.handle();
  }

  protected async execute(): Promise<void> {
    await this.publishPending.run();
  }
}
