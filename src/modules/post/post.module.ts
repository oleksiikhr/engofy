import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import AiConfig from '../../core/ai/ai.config.js';
import { aiClientProvider } from '../../core/ai/ai-client.provider.js';
import NlpConfig from '../../core/nlp/nlp.config.js';
import { nlpClientProvider } from '../../core/nlp/nlp-client.provider.js';
import { AnnotatePostHandler } from './commands/annotate-post/annotate-post.handler.js';
import { AssessComplexityHandler } from './commands/assess-complexity/assess-complexity.handler.js';
import { GenerateExercisesHandler } from './commands/generate-exercises/generate-exercises.handler.js';
import { IngestPostHandler } from './commands/ingest-post/ingest-post.handler.js';
import { PublishPostHandler } from './commands/publish-post/publish-post.handler.js';
import { RetryPostHandler } from './commands/retry-post/retry-post.handler.js';
import { SpacyParsePostHandler } from './commands/spacy-parse-post/spacy-parse-post.handler.js';
import { TagGrammarHandler } from './commands/tag-grammar/tag-grammar.handler.js';
import { PostService } from './post.service.js';
import { PostQueueBootstrapService } from './post-queue-bootstrap.service.js';

const commandHandlers = [
  IngestPostHandler,
  AnnotatePostHandler,
  SpacyParsePostHandler,
  AssessComplexityHandler,
  TagGrammarHandler,
  GenerateExercisesHandler,
  PublishPostHandler,
  RetryPostHandler,
];

@Module({
  imports: [
    ConfigModule.forFeature(AiConfig),
    ConfigModule.forFeature(NlpConfig),
    CqrsModule,
  ],
  providers: [
    PostService,
    PostQueueBootstrapService,
    aiClientProvider,
    nlpClientProvider,
    ...commandHandlers,
  ],
  exports: [PostService],
})
export class PostModule {}
