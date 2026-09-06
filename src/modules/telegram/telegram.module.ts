import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import AppConfig from '../../core/config/app.config.js';
import { PostModule } from '../post/post.module.js';
import TelegramConfig from './config/telegram.config.js';
import { PollUpdatesService } from './services/shared/poll-updates.service.js';
import { PruneTelegramUpdatesService } from './services/shared/prune-telegram-updates.service.js';
import { PublishPendingService } from './services/shared/publish-pending.service.js';
import { TelegramClientService } from './services/telegram-client.service.js';

// Admin bot + channel publishing (PLAN.md §3.8, §3.9). The two poller services
// are driven by @Cron ticks in the cron entrypoint (TelegramCronModule); they
// live in services/shared/ and own their own flush-per-row (D15).
@Module({
  imports: [
    ConfigModule.forFeature(TelegramConfig),
    ConfigModule.forFeature(AppConfig),
    PostModule,
  ],
  providers: [
    TelegramClientService,
    PollUpdatesService,
    PublishPendingService,
    PruneTelegramUpdatesService,
  ],
  exports: [
    PollUpdatesService,
    PublishPendingService,
    PruneTelegramUpdatesService,
  ],
})
export class TelegramModule {}
