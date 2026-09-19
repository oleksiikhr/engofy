import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import AiConfig from '../../core/ai/ai.config.js';
import { aiClientProvider } from '../../core/ai/ai-client.provider.js';
import NlpConfig from '../../core/nlp/nlp.config.js';
import { nlpClientProvider } from '../../core/nlp/nlp-client.provider.js';
import { AnnotatePostHandler } from './commands/annotate-post/annotate-post.handler.js';
import { AssessComplexityHandler } from './commands/assess-complexity/assess-complexity.handler.js';
import { BackfillEnrichmentHandler } from './commands/backfill-enrichment/backfill-enrichment.handler.js';
import { EnrichLexiconHandler } from './commands/enrich-lexicon/enrich-lexicon.handler.js';
import { GenerateExercisesHandler } from './commands/generate-exercises/generate-exercises.handler.js';
import { IngestPostHandler } from './commands/ingest-post/ingest-post.handler.js';
import { MarkPostReadHandler } from './commands/mark-post-read/mark-post-read.handler.js';
import { PublishPostHandler } from './commands/publish-post/publish-post.handler.js';
import { RetryPostHandler } from './commands/retry-post/retry-post.handler.js';
import { SpacyParsePostHandler } from './commands/spacy-parse-post/spacy-parse-post.handler.js';
import { TagGrammarHandler } from './commands/tag-grammar/tag-grammar.handler.js';
import { PostService } from './post.service.js';
import { PostQueueBootstrapService } from './post-queue-bootstrap.service.js';
import { GetFeedHandler } from './queries/get-feed/get-feed.handler.js';
import { GetGrammarConstructionHandler } from './queries/get-grammar-construction/get-grammar-construction.handler.js';
import { GetGrammarReferenceHandler } from './queries/get-grammar-reference/get-grammar-reference.handler.js';
import { GetPostDetailHandler } from './queries/get-post-detail/get-post-detail.handler.js';
import { GetPostsListHandler } from './queries/get-posts-list/get-posts-list.handler.js';

const commandHandlers = [
  IngestPostHandler,
  AnnotatePostHandler,
  SpacyParsePostHandler,
  AssessComplexityHandler,
  TagGrammarHandler,
  EnrichLexiconHandler,
  BackfillEnrichmentHandler,
  GenerateExercisesHandler,
  PublishPostHandler,
  RetryPostHandler,
  MarkPostReadHandler,
];

const queryHandlers = [
  GetFeedHandler,
  GetPostsListHandler,
  GetPostDetailHandler,
  GetGrammarReferenceHandler,
  GetGrammarConstructionHandler,
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
    ...queryHandlers,
  ],
  exports: [PostService],
})
export class PostModule {}
