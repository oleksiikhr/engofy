import type { OnApplicationBootstrap } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { PgBoss } from 'pg-boss';
import { PG_BOSS } from '../../core/queue/queue.tokens.js';
import { QueueName } from '../../core/queue/queue-names.enum.js';

@Injectable()
export class ContentQueueBootstrapService implements OnApplicationBootstrap {
  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.boss.createQueue(QueueName.ContentAnnotation);
  }
}
