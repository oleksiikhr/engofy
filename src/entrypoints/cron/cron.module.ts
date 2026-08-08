import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScraperCronModule } from './scraper/scraper-cron.module.js';

@Module({
  imports: [ScheduleModule.forRoot(), ScraperCronModule],
})
export class CronModule {}
