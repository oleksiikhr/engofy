import type { DynamicModule, Type } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { QueueName } from '../../core/queue/queue-names.enum.js';
import { SendChallengeEmailModule } from './auth/send-challenge-email.module.js';
import { SendChallengeEmailProcessor } from './auth/send-challenge-email.processor.js';
import { AnnotatePostModule } from './post/annotate-post.module.js';
import { AnnotatePostProcessor } from './post/annotate-post.processor.js';
import { AssessComplexityModule } from './post/assess-complexity.module.js';
import { AssessComplexityProcessor } from './post/assess-complexity.processor.js';
import { GenerateExercisesModule } from './post/generate-exercises.module.js';
import { GenerateExercisesProcessor } from './post/generate-exercises.processor.js';
import { PublishPostModule } from './post/publish-post.module.js';
import { PublishPostProcessor } from './post/publish-post.processor.js';
import { SpacyParsePostModule } from './post/spacy-parse-post.module.js';
import { SpacyParsePostProcessor } from './post/spacy-parse-post.processor.js';
import { TagGrammarModule } from './post/tag-grammar.module.js';
import { TagGrammarProcessor } from './post/tag-grammar.processor.js';
import { WORKER_QUEUES } from './worker.tokens.js';
import { WorkerRegistrarService } from './worker-registrar.service.js';

const PROCESSOR_CONFIG: Record<string, { processor: Type; module: Type }> = {
  [QueueName.AuthChallengeEmail]: {
    processor: SendChallengeEmailProcessor,
    module: SendChallengeEmailModule,
  },
  [QueueName.PostAnnotation]: {
    processor: AnnotatePostProcessor,
    module: AnnotatePostModule,
  },
  [QueueName.PostSpacyParse]: {
    processor: SpacyParsePostProcessor,
    module: SpacyParsePostModule,
  },
  [QueueName.PostAiComplexity]: {
    processor: AssessComplexityProcessor,
    module: AssessComplexityModule,
  },
  [QueueName.PostAiGrammar]: {
    processor: TagGrammarProcessor,
    module: TagGrammarModule,
  },
  [QueueName.PostAiExercises]: {
    processor: GenerateExercisesProcessor,
    module: GenerateExercisesModule,
  },
  [QueueName.PostPublish]: {
    processor: PublishPostProcessor,
    module: PublishPostModule,
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
