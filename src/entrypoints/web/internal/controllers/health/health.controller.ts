import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  HealthCheck,
  HealthCheckService,
  MikroOrmHealthIndicator,
} from '@nestjs/terminus';
import { Public } from '../../../../../core/decorators/public.decorator.js';
import { RedisHealthIndicator } from './redis.health.js';

// Two probes, deliberately separated (PLAN.md §7):
//
//   GET /_healthz        liveness  — the process is up and the event loop
//                        answers. No dependency checks. This is what the
//                        container runtime (Docker/Swarm HEALTHCHECK) polls;
//                        a Redis/Postgres blip must NOT make the orchestrator
//                        kill an otherwise-serving task.
//
//   GET /_healthz/ready  readiness — 200 only when Postgres AND Redis answer.
//                        For a load balancer / manual check deciding whether
//                        to send traffic. A failure here is a 503 via
//                        HealthCheckErrorFilter.
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
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
