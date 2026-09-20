import { Module } from '@nestjs/common';
import { TelegramModule } from '../../../modules/telegram/telegram.module.js';
import { NotifyFailedPostsCron } from './notify-failed-posts.cron.js';
import { NotifyPublishedPostsCron } from './notify-published-posts.cron.js';
import { PollUpdatesCron } from './poll-updates.cron.js';
import { PruneTelegramUpdatesCron } from './prune-telegram-updates.cron.js';
import { PublishPendingCron } from './publish-pending.cron.js';

@Module({
  imports: [TelegramModule],
  providers: [
    PollUpdatesCron,
    PublishPendingCron,
    NotifyFailedPostsCron,
    NotifyPublishedPostsCron,
    PruneTelegramUpdatesCron,
  ],
})
export class TelegramCronModule {}
