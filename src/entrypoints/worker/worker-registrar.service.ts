import type { OnApplicationBootstrap, Type } from '@nestjs/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Job, PgBoss } from 'pg-boss';
import { PG_BOSS } from '../../core/queue/queue.tokens.js';
import type { SentryTraceFields } from '../../core/queue/sentry-trace.js';
import type { JobWorkerHost } from './job-worker-host.js';
import { WORKER_QUEUES } from './worker.tokens.js';

@Injectable()
export class WorkerRegistrarService implements OnApplicationBootstrap {
  private readonly logger = new Logger(this.constructor.name);

  constructor(
    @Inject(PG_BOSS) private readonly boss: PgBoss,
    @Inject(WORKER_QUEUES)
    private readonly queues: Record<string, Type<JobWorkerHost>>,
    private readonly moduleRef: ModuleRef,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await Promise.all(
      Object.entries(this.queues).map(async ([queueName, processorClass]) => {
        const processor = this.moduleRef.get(processorClass, {
          strict: false,
        });

        await this.boss.createQueue(queueName);
        await this.boss.work(queueName, (jobs: Job<SentryTraceFields>[]) =>
          processor.work(jobs),
        );

        this.logger.log(`Registered worker for queue "${queueName}"`);
      }),
    );
  }
}
