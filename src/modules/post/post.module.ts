import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import AiConfig from '../../core/ai/ai.config.js';
import { aiClientProvider } from '../../core/ai/ai-client.provider.js';
import { AnnotatePostHandler } from './commands/annotate-post/annotate-post.handler.js';
import { IngestPostHandler } from './commands/ingest-post/ingest-post.handler.js';
import { PostService } from './post.service.js';
import { PostQueueBootstrapService } from './post-queue-bootstrap.service.js';

const commandHandlers = [IngestPostHandler, AnnotatePostHandler];

@Module({
  imports: [ConfigModule.forFeature(AiConfig), CqrsModule],
  providers: [
    PostService,
    PostQueueBootstrapService,
    aiClientProvider,
    ...commandHandlers,
  ],
  exports: [PostService],
})
export class PostModule {}
