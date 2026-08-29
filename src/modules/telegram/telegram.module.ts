import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import AppConfig from '../../core/config/app.config.js';
import { PostModule } from '../post/post.module.js';
import TelegramConfig from './config/telegram.config.js';
import { PollUpdatesService } from './services/poll-updates.service.js';
import { PublishPendingService } from './services/publish-pending.service.js';
import { TelegramClientService } from './services/telegram-client.service.js';

// Admin bot + channel publishing (PLAN.md §3.8, §3.9). The two services are
// driven by @Cron ticks in the cron entrypoint (TelegramCronModule).
@Module({
  imports: [
    ConfigModule.forFeature(TelegramConfig),
    ConfigModule.forFeature(AppConfig),
    PostModule,
  ],
  providers: [TelegramClientService, PollUpdatesService, PublishPendingService],
  exports: [PollUpdatesService, PublishPendingService],
})
export class TelegramModule {}
