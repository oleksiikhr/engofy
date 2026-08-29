import type { OnApplicationBootstrap } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { PgBoss } from 'pg-boss';
import { PG_BOSS } from '../../core/queue/queue.tokens.js';
import { QueueName } from '../../core/queue/queue-names.enum.js';

@Injectable()
export class PostQueueBootstrapService implements OnApplicationBootstrap {
  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.boss.createQueue(QueueName.PostAnnotation, {
      policy: 'singleton',
      expireInSeconds: 3600,
    });

    await this.boss.createQueue(QueueName.PostSpacyParse, {
      policy: 'singleton',
      expireInSeconds: 3600,
    });

    await this.boss.createQueue(QueueName.PostAiComplexity, {
      policy: 'singleton',
      expireInSeconds: 3600,
    });

    await this.boss.createQueue(QueueName.PostAiGrammar, {
      policy: 'singleton',
      expireInSeconds: 3600,
    });

    await this.boss.createQueue(QueueName.PostAiExercises, {
      policy: 'singleton',
      expireInSeconds: 3600,
    });

    await this.boss.createQueue(QueueName.PostPublish, {
      policy: 'singleton',
      expireInSeconds: 3600,
    });
  }
}
