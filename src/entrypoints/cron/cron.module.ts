import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegramCronModule } from './telegram/telegram-cron.module.js';

@Module({
  imports: [ScheduleModule.forRoot(), TelegramCronModule],
})
export class CronModule {}
