import { Module } from '@nestjs/common';
import { ContentModule } from '../../../modules/content/content.module.js';
import { ContentCommand } from './content.command.js';
import { ContentIngestCommand } from './content-ingest.command.js';

@Module({
  imports: [ContentModule],
  providers: [ContentCommand, ContentIngestCommand],
})
export class ContentCliModule {}
