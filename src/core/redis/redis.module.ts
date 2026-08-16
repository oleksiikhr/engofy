import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import RedisConfig from './redis.config.js';
import { redisProvider } from './redis.provider.js';
import { REDIS_CLIENT } from './redis.tokens.js';
import { RedisLifecycleService } from './redis-lifecycle.service.js';

@Global()
@Module({
  imports: [ConfigModule.forFeature(RedisConfig)],
  providers: [redisProvider, RedisLifecycleService],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
