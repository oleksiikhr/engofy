import type { Provider } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PgBoss } from 'pg-boss';
import type { AppRuntime } from '../app.js';
import QueueConfig from './config/queue.config.js';
import { PG_BOSS } from './queue.tokens.js';

export function pgBossProvider(runtime: AppRuntime): Provider {
  return {
    provide: PG_BOSS,
    inject: [QueueConfig.KEY],
    useFactory: async (config: ConfigType<typeof QueueConfig>) => {
      const boss = new PgBoss({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        max: config.poolMax,
        // Maintenance (archiving, retry scans, monitoring) runs on the cron runtime,
        // which is always a single process — workers scale horizontally, so pinning
        // supervise there would mean every replica repeats the same maintenance work.
        supervise: runtime === 'cron',
      });

      await boss.start();

      return boss;
    },
  };
}
