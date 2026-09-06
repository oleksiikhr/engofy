import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './controllers/health/health.controller.js';
import { RedisHealthIndicator } from './controllers/health/redis.health.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class InternalWebModule {}
