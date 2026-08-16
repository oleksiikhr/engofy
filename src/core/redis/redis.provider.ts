import type { Provider } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';
import RedisConfig from './redis.config.js';
import { REDIS_CLIENT } from './redis.tokens.js';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [RedisConfig.KEY],
  useFactory: (config: ConfigType<typeof RedisConfig>) =>
    new Redis({
      host: config.host,
      port: config.port,
      ...(config.password && { password: config.password }),
    }),
};
