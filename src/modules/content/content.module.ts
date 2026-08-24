import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { IngestContentHandler } from './commands/ingest-content/ingest-content.handler.js';
import { ContentService } from './content.service.js';
import { ContentQueueBootstrapService } from './content-queue-bootstrap.service.js';

const commandHandlers = [IngestContentHandler];

@Module({
  imports: [CqrsModule],
  providers: [ContentService, ContentQueueBootstrapService, ...commandHandlers],
  exports: [ContentService],
})
export class ContentModule {}
