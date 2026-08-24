import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import AiConfig from '../../core/ai/ai.config.js';
import { aiClientProvider } from '../../core/ai/ai-client.provider.js';
import { AnnotateContentHandler } from './commands/annotate-content/annotate-content.handler.js';
import { IngestContentHandler } from './commands/ingest-content/ingest-content.handler.js';
import { ContentService } from './content.service.js';
import { ContentQueueBootstrapService } from './content-queue-bootstrap.service.js';

const commandHandlers = [IngestContentHandler, AnnotateContentHandler];

@Module({
  imports: [ConfigModule.forFeature(AiConfig), CqrsModule],
  providers: [
    ContentService,
    ContentQueueBootstrapService,
    aiClientProvider,
    ...commandHandlers,
  ],
  exports: [ContentService],
})
export class ContentModule {}
