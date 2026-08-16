import type { Provider } from '@nestjs/common';
import { Logger } from '@nestjs/common';
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
      const logger = new Logger('PgBoss');

      const boss = new PgBoss({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        max: config.poolMax,
        supervise: runtime === 'cron',
      });

      boss.on('error', (err) => logger.error({ err }, 'pg-boss error'));
      boss.on('warning', ({ message, data }) =>
        logger.warn(data, `pg-boss warning: ${message}`),
      );

      await boss.start();

      return boss;
    },
  };
}
