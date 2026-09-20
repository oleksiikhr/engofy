import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotifyStuckPostsService } from '../../../modules/telegram/services/shared/notify-stuck-posts.service.js';
import { CronJobHost } from '../cron-job-host.js';

// Alert the admin chat about posts idle in `processing` once a minute. No-ops
// when the bot token or admin id is unset.
@Injectable()
export class NotifyStuckPostsCron extends CronJobHost {
  constructor(private readonly notifyStuckPosts: NotifyStuckPostsService) {
    super();
  }

  @Cron('* * * * *', { waitForCompletion: true })
  override async handle(): Promise<void> {
    return super.handle();
  }

  protected async execute(): Promise<void> {
    await this.notifyStuckPosts.run();
  }
}
