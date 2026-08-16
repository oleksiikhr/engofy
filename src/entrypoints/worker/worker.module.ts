import type { DynamicModule, Type } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { QueueName } from '../../core/queue/queue-names.enum.js';
import { SendChallengeEmailModule } from './auth/send-challenge-email.module.js';
import { SendChallengeEmailProcessor } from './auth/send-challenge-email.processor.js';
import { WORKER_QUEUES } from './worker.tokens.js';
import { WorkerRegistrarService } from './worker-registrar.service.js';

const PROCESSOR_CONFIG: Record<string, { processor: Type; module: Type }> = {
  [QueueName.AuthChallengeEmail]: {
    processor: SendChallengeEmailProcessor,
    module: SendChallengeEmailModule,
  },
};

@Module({})
// biome-ignore lint/complexity/noStaticOnlyClass: NestJS dynamic module pattern (forRoot/forFeature)
export class WorkerModule {
  static forQueues(queues: string[]): DynamicModule {
    const unknown = queues.filter((q) => !Object.hasOwn(PROCESSOR_CONFIG, q));
    if (unknown.length > 0) {
      throw new Error('No processor registered for queue', {
        cause: { queues: unknown },
      });
    }

    const names = queues.length > 0 ? queues : Object.keys(PROCESSOR_CONFIG);

    return {
      module: WorkerModule,
      imports: names.map((name) => PROCESSOR_CONFIG[name].module),
      providers: [
        WorkerRegistrarService,
        {
          provide: WORKER_QUEUES,
          useValue: Object.fromEntries(
            names.map((name) => [name, PROCESSOR_CONFIG[name].processor]),
          ),
        },
      ],
    };
  }
}
