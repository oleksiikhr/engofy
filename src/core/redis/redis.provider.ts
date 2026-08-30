import { Logger, type Provider } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';
import RedisConfig from './redis.config.js';
import { REDIS_CLIENT } from './redis.tokens.js';

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [RedisConfig.KEY],
  useFactory: (config: ConfigType<typeof RedisConfig>) => {
    const logger = new Logger('Redis');

    const client = new Redis({
      host: config.host,
      port: config.port,
      ...(config.password && { password: config.password }),
    });

    // ioredis emits 'error' on connection/command failures; with no listener
    // attached an emitted error becomes an unhandled exception and crashes the
    // process. Mirrors the 'error'/'warning' handlers on the pg-boss client.
    client.on('error', (err) => logger.error({ err }, 'redis client error'));

    return client;
  },
};
