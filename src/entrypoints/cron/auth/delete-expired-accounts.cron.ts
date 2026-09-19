import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DeleteExpiredAccountsService } from '../../../modules/auth/services/shared/delete-expired-accounts.service.js';
import { CronJobHost } from '../cron-job-host.js';

// Hard-deletes accounts whose 30-day deletion grace period has passed, once a
// day (04:00).
@Injectable()
export class DeleteExpiredAccountsCron extends CronJobHost {
  constructor(private readonly deleteExpired: DeleteExpiredAccountsService) {
    super();
  }

  @Cron('0 4 * * *', { waitForCompletion: true })
  override async handle(): Promise<void> {
    return super.handle();
  }

  protected async execute(): Promise<void> {
    await this.deleteExpired.run();
  }
}
