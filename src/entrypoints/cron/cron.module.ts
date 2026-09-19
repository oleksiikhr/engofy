import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthCronModule } from './auth/auth-cron.module.js';
import { TelegramCronModule } from './telegram/telegram-cron.module.js';

@Module({
  imports: [ScheduleModule.forRoot(), AuthCronModule, TelegramCronModule],
})
export class CronModule {}
