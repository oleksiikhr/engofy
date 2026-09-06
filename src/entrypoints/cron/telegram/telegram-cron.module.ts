import { Module } from '@nestjs/common';
import { TelegramModule } from '../../../modules/telegram/telegram.module.js';
import { PollUpdatesCron } from './poll-updates.cron.js';
import { PruneTelegramUpdatesCron } from './prune-telegram-updates.cron.js';
import { PublishPendingCron } from './publish-pending.cron.js';

@Module({
  imports: [TelegramModule],
  providers: [PollUpdatesCron, PublishPendingCron, PruneTelegramUpdatesCron],
})
export class TelegramCronModule {}
