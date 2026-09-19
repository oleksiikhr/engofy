import type { OnApplicationBootstrap } from '@nestjs/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PgBoss } from 'pg-boss';
import { PG_BOSS } from '../../../core/queue/queue.tokens.js';
import {
  AUTH_ACCOUNT_DELETION_EMAIL_QUEUE,
  AUTH_CHALLENGE_EMAIL_QUEUE,
} from '../../../core/queue/queue-config.js';
import { QueueName } from '../../../core/queue/queue-names.enum.js';

// Declares the auth email queues on their own, independent of the post
// pipeline's `PostQueueBootstrapService` — login is a core flow and must not
// depend on `PostModule` being loaded for its queue to exist. Runs on
// bootstrap of any runtime that imports `AuthModule` (web login, and the
// worker that processes this queue).
@Injectable()
export class AuthQueueBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthQueueBootstrapService.name);

  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.boss.createQueue(
      QueueName.AuthChallengeEmail,
      AUTH_CHALLENGE_EMAIL_QUEUE,
    );

    await this.boss.createQueue(
      QueueName.AuthAccountDeletionEmail,
      AUTH_ACCOUNT_DELETION_EMAIL_QUEUE,
    );

    this.logger.log('auth email queues declared');
  }
}
