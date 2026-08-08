import { Module } from '@nestjs/common';
import { ScraperCron } from './scraper.cron.js';

@Module({
  providers: [ScraperCron],
})
export class ScraperCronModule {}
