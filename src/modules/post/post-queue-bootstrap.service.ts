import type { OnApplicationBootstrap } from '@nestjs/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PgBoss } from 'pg-boss';
import { PG_BOSS } from '../../core/queue/queue.tokens.js';
import {
  POST_DEAD_LETTER_QUEUE,
  QUEUE_DEFINITIONS,
} from '../../core/queue/queue-config.js';

// The single `boss.createQueue` authority for the whole app (D8). Every queue —
// including the auth challenge-email queue — is declared here from the shared
// `QUEUE_DEFINITIONS` map, so policy / expiry / retry / dead-letter can't drift
// between callers. `WorkerRegistrarService` only `boss.work()`s pre-existing
// queues. Runs on bootstrap of any runtime that imports `PostModule` (web,
// cron, cli, and every worker that runs a post stage).
@Injectable()
export class PostQueueBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PostQueueBootstrapService.name);

  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  async onApplicationBootstrap(): Promise<void> {
    // Dead-letter target first — the AI stages reference it by name.
    await this.boss.createQueue(POST_DEAD_LETTER_QUEUE);

    await Promise.all(
      Object.entries(QUEUE_DEFINITIONS).map(([name, options]) =>
        this.boss.createQueue(name, options),
      ),
    );

    this.logger.log('pg-boss queues declared');
  }
}
