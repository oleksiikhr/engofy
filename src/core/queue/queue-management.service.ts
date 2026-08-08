import { Inject, Injectable } from '@nestjs/common';
import type { PgBoss, QueueStats } from 'pg-boss';
import { PG_BOSS } from './queue.tokens.js';
import { ALL_QUEUE_NAMES } from './queue-names.enum.js';

@Injectable()
export class QueueManagementService {
  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  async getStats(queue: string): Promise<QueueStats[]> {
    const stats = await Promise.all(
      this.resolveNames(queue).map((name) => this.boss.getQueueStats(name)),
    );

    return stats.flat();
  }

  /**
   * Bulk-retries jobs in `failed` state. Unlike `boss.redrive()`, this does not
   * require the queue to have a `deadLetter` queue configured.
   */
  async retryFailed(queue: string): Promise<number> {
    const counts = await Promise.all(
      this.resolveNames(queue).map((name) => this.retryFailedForQueue(name)),
    );

    return counts.reduce((sum, count) => sum + count, 0);
  }

  async deleteAll(queue: string): Promise<void> {
    await this.boss.deleteAllJobs(queue);
  }

  private async retryFailedForQueue(name: string): Promise<number> {
    const jobs = await this.boss.findJobs<unknown>(name);
    const failedIds = jobs
      .filter((job) => job.state === 'failed')
      .map((job) => job.id);

    if (failedIds.length === 0) {
      return 0;
    }

    await this.boss.retry(name, failedIds);

    return failedIds.length;
  }

  private resolveNames(queue: string): string[] {
    return queue === 'all' ? ALL_QUEUE_NAMES : [queue];
  }
}
