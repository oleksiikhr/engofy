import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import pg from 'pg';
import QueueConfig from './config/queue.config.js';

// Session-level Postgres advisory lock on its own connection: the lock belongs
// to that connection, so it cannot be taken on a pooled one and released on
// another. The server drops it if the process dies, so a crash never leaves a
// stale lock. Uses the direct endpoint (`QueueConfig`), not a transaction pooler.
@Injectable()
export class AdvisoryLockService {
  constructor(
    @Inject(QueueConfig.KEY)
    private readonly config: ConfigType<typeof QueueConfig>,
  ) {}

  /** Runs `work` while holding the lock; resolves `false` without running it if another holder has it. */
  async tryRun(key: number, work: () => Promise<void>): Promise<boolean> {
    const client = new pg.Client({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
    });

    await client.connect();

    try {
      const { rows } = await client.query<{ locked: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS locked',
        [key],
      );

      if (!rows[0]?.locked) {
        return false;
      }

      await work();

      return true;
    } finally {
      // Closing the connection releases the lock.
      await client.end();
    }
  }
}
