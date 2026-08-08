import type { OnApplicationShutdown } from '@nestjs/common';
import { Inject, Injectable } from '@nestjs/common';
import type { PgBoss } from 'pg-boss';
import { PG_BOSS } from './queue.tokens.js';

@Injectable()
export class PgBossLifecycleService implements OnApplicationShutdown {
  constructor(@Inject(PG_BOSS) private readonly boss: PgBoss) {}

  async onApplicationShutdown(): Promise<void> {
    await this.boss.stop();
  }
}
