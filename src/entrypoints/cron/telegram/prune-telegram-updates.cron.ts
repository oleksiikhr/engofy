import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PruneTelegramUpdatesService } from '../../../modules/telegram/services/shared/prune-telegram-updates.service.js';
import { CronJobHost } from '../cron-job-host.js';

// D15 #32 / security.md: telegram_updates.raw_payload retains every sender's
// username + text. Prune rows older than 30 days once a day (03:00).
@Injectable()
export class PruneTelegramUpdatesCron extends CronJobHost {
  constructor(private readonly pruneUpdates: PruneTelegramUpdatesService) {
    super();
  }

  @Cron('0 3 * * *', { waitForCompletion: true })
  override async handle(): Promise<void> {
    return super.handle();
  }

  protected async execute(): Promise<void> {
    await this.pruneUpdates.run();
  }
}
