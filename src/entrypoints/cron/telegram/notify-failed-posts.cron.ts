import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotifyFailedPostsService } from '../../../modules/telegram/services/shared/notify-failed-posts.service.js';
import { CronJobHost } from '../cron-job-host.js';

// Alert the admin chat about `failed` posts once a minute. No-ops when the bot
// token or admin id is unset.
@Injectable()
export class NotifyFailedPostsCron extends CronJobHost {
  constructor(private readonly notifyFailedPosts: NotifyFailedPostsService) {
    super();
  }

  @Cron('* * * * *', { waitForCompletion: true })
  override async handle(): Promise<void> {
    return super.handle();
  }

  protected async execute(): Promise<void> {
    await this.notifyFailedPosts.run();
  }
}
