import { Inject, Injectable } from '@nestjs/common';
import {
  type HealthIndicatorResult,
  HealthIndicatorService,
} from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../../../../../core/redis/redis.tokens.js';

// Terminus readiness probe for the Redis connection (sessions + rate-limit
// counters). Mirrors the built-in `MikroOrmHealthIndicator.pingCheck`.
@Injectable()
export class RedisHealthIndicator {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      const reply = await this.redis.ping();
      return reply === 'PONG'
        ? indicator.up()
        : indicator.down({ message: `unexpected PING reply: ${reply}` });
    } catch (error) {
      return indicator.down({
        message: error instanceof Error ? error.message : 'PING failed',
      });
    }
  }
}
