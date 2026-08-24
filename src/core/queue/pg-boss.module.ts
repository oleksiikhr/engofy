import type { DynamicModule } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import type { AppRuntime } from '../app.js';
import QueueConfig from './config/queue.config.js';
import { OutboxSubscriber } from './outbox.subscriber.js';
import { OutboxSenderService } from './outbox-sender.service.js';
import { pgBossProvider } from './pg-boss.provider.js';
import { PgBossLifecycleService } from './pg-boss-lifecycle.service.js';
import { PG_BOSS } from './queue.tokens.js';
import { QueueManagementService } from './queue-management.service.js';

@Global()
@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern (forRoot/forFeature)
export class PgBossModule {
  static forRuntime(runtime: AppRuntime): DynamicModule {
    return {
      module: PgBossModule,
      imports: [ConfigModule.forFeature(QueueConfig)],
      providers: [
        pgBossProvider(runtime),
        PgBossLifecycleService,
        OutboxSenderService,
        OutboxSubscriber,
        QueueManagementService,
      ],
      exports: [PG_BOSS, OutboxSenderService, QueueManagementService],
    };
  }
}
