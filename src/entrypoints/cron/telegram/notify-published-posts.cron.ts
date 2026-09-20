import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotifyPublishedPostsService } from '../../../modules/telegram/services/shared/notify-published-posts.service.js';
import { CronJobHost } from '../cron-job-host.js';

// Notify the admin chat about newly `published` posts once a minute. No-ops
// when the bot token or admin id is unset.
@Injectable()
export class NotifyPublishedPostsCron extends CronJobHost {
  constructor(
    private readonly notifyPublishedPosts: NotifyPublishedPostsService,
  ) {
    super();
  }

  @Cron('* * * * *', { waitForCompletion: true })
  override async handle(): Promise<void> {
    return super.handle();
  }

  protected async execute(): Promise<void> {
    await this.notifyPublishedPosts.run();
  }
}
