import { Command } from '@nestjs/cqrs';
import type { Content } from '../../entities/content.entity.js';
import type { IngestContentDto } from './ingest-content.dto.js';

export class IngestContentCommand extends Command<Content> {
  constructor(readonly dto: IngestContentDto) {
    super();
  }
}
