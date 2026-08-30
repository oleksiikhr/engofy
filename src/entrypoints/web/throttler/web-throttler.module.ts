import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Module } from '@nestjs/common';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Redis } from 'ioredis';
import ThrottlerConfig from '../../../core/config/throttler.config.js';
import { isTestEnvironment } from '../../../core/enums/environment.enum.js';
import { REDIS_CLIENT } from '../../../core/redis/redis.tokens.js';

// Edge rate limiting (PLAN.md §7). Registered as the first global guard so a
// flood is rejected before `SessionAuthGuard` touches the session store.
// Disabled under test — the integration suites share one Redis DB and run with
// `isolate: false`, so a real window would make unrelated specs flaky.
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule.forFeature(ThrottlerConfig)],
      inject: [ThrottlerConfig.KEY, REDIS_CLIENT],
      useFactory: (
        config: ConfigType<typeof ThrottlerConfig>,
        redis: Redis,
      ) => ({
        throttlers: [{ ttl: config.ttlMs, limit: config.limit }],
        storage: new ThrottlerStorageRedisService(redis),
        skipIf: () => isTestEnvironment(),
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class WebThrottlerModule {}
