import { LockMode } from '@mikro-orm/core';
import { EntityManager } from '@mikro-orm/postgresql';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { DateTime } from 'luxon';
import AuthConfig from '../../config/auth.config.js';
import { AccountDeletionRequest } from '../../entities/account-deletion-request.entity.js';

// Every table holding a learner's rows, keyed by a plain `user_id` column (no
// FKs). `review_logs` has no user column — it is reached through the user's
// cards, so it is deleted first, before `learning_cards`. A new user-owned
// table must be added here; the ispec fails if one is missing.
export const USER_OWNED_TABLES = [
  'learning_dispositions',
  'learning_cards',
  'user_skill_progress',
  'post_reads',
  'daily_plans',
  'subscriptions',
  'auth_sessions',
  'account_deletion_requests',
] as const;

// Deletes accounts whose deletion request outlived the grace period and was
// not cancelled. Hard delete of every related row (not anonymisation), one
// transaction per account so a failure leaves that account fully intact.
//
// Cron-driven, so it lives in services/shared/ and owns its own writes (D15).
@Injectable()
export class DeleteExpiredAccountsService {
  private readonly logger = new Logger(DeleteExpiredAccountsService.name);

  constructor(
    private readonly em: EntityManager,
    @Inject(AuthConfig.KEY)
    private readonly config: ConfigType<typeof AuthConfig>,
  ) {}

  async run(): Promise<void> {
    const cutoff = DateTime.now().minus({
      days: this.config.accountDeletionGraceDays,
    });

    const due = await this.em.find(
      AccountDeletionRequest,
      { cancelledAt: null, requestedAt: { $lte: cutoff } },
      { fields: ['id', 'userId'], orderBy: { requestedAt: 'asc' } },
    );

    let deleted = 0;
    let failed = 0;

    for (const { id, userId } of due) {
      try {
        // biome-ignore lint/performance/noAwaitInLoops: one transaction per account, sequential so a failure leaves the rest untouched.
        if (await this.deleteAccount(id, userId)) {
          deleted++;
        }
      } catch (err) {
        failed++;
        this.logger.error({ err, userId }, 'account deletion failed');
      }
    }

    if (deleted > 0) {
      this.logger.log({ deleted }, 'deleted accounts past the grace period');
    }

    if (failed > 0) {
      throw new Error(`Failed to delete ${failed} account(s)`);
    }
  }

  // Returns false when the request was cancelled after it was selected.
  private async deleteAccount(
    requestId: string,
    userId: string,
  ): Promise<boolean> {
    return this.em.transactional(async (em) => {
      // Row lock: a cancel racing this delete either commits first (and this
      // finds nothing) or waits until the delete has committed.
      const request = await em.findOne(
        AccountDeletionRequest,
        { id: requestId, cancelledAt: null },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      if (!request) {
        return false;
      }

      const connection = em.getConnection();
      const trx = em.getTransactionContext();
      const run = (sql: string, params: unknown[]) =>
        connection.execute(sql, params, 'run', trx);

      await run(
        'delete from review_logs where card_id in (select id from learning_cards where user_id = ?)',
        [userId],
      );
      for (const table of USER_OWNED_TABLES) {
        // biome-ignore lint/performance/noAwaitInLoops: statements share one transaction connection and must run in order.
        await run(`delete from ${table} where user_id = ?`, [userId]);
      }
      // Pending OTP challenge is keyed by e-mail, not user id.
      await run(
        'delete from auth_challenges where email = (select email from users where id = ?)',
        [userId],
      );
      await run('delete from users where id = ?', [userId]);

      return true;
    });
  }
}
