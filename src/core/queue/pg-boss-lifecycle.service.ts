import type { OnApplicationShutdown } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { PgBoss } from 'pg-boss';
import QueueConfig from './config/queue.config.js';
import { PG_BOSS } from './queue.tokens.js';

@Injectable()
export class PgBossLifecycleService implements OnApplicationShutdown {
  constructor(
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    @Inject(QueueConfig.KEY)
    private readonly config: ConfigType<typeof QueueConfig>,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.boss.stop({
      graceful: true,
      timeout: this.config.shutdownTimeoutMs,
    });
  }
}
