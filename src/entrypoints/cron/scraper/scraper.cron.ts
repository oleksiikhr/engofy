import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CronJobHost } from '../cron-job-host.js';

@Injectable()
export class ScraperCron extends CronJobHost {
  @Cron('* * * * *', { waitForCompletion: true })
  override async handle(): Promise<void> {
    return super.handle();
  }

  protected async execute(): Promise<void> {
    this.logger.log({ foo: 'bar' }, 'Enqueueing scrape jobs');
  }
}
