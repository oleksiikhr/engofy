import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MikroOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../../../../core/decorators/public.decorator.js';
import { RedisHealthIndicator } from './redis.health.js';

// Readiness probe (PLAN.md §7): 200 only when Postgres and Redis both answer.
@ApiTags('internal')
@Public()
@Controller('_healthz')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: MikroOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
