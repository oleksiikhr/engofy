import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';

const RETENTION_DAYS = 30;

// Prunes telegram_updates rows older than RETENTION_DAYS. The table keeps the
// raw getUpdates payload of every sender (usernames + message text) for audit;
// nothing reads a row once it's processed, and the next poll offset comes from
// max(update_id), which this DELETE never lowers (only old, already-processed
// rows are removed). Raw set-based DELETE the ORM can't express without loading
// every row into the identity map (DP5 / M5).
//
// Cron-driven, so it lives in services/shared/ and owns its own write (D15).
@Injectable()
export class PruneTelegramUpdatesService {
  private readonly logger = new Logger(PruneTelegramUpdatesService.name);

  constructor(private readonly em: EntityManager) {}

  async run(): Promise<void> {
    const cutoff = DateTime.now().minus({ days: RETENTION_DAYS });

    const result = await this.em
      .getConnection()
      .execute<{ affectedRows: number }>(
        'DELETE FROM telegram_updates WHERE created_at < ?',
        [cutoff.toJSDate()],
        'run',
        this.em.getTransactionContext(),
      );

    if (result.affectedRows > 0) {
      this.logger.log(
        { deleted: result.affectedRows, olderThanDays: RETENTION_DAYS },
        'pruned old telegram updates',
      );
    }
  }
}
