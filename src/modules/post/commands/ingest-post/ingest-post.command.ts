import { Command } from '@nestjs/cqrs';
import type { IngestedPostView } from '../../types/ingested-post-view.type.js';
import type { IngestPostDto } from './ingest-post.dto.js';

export class IngestPostCommand extends Command<IngestedPostView> {
  constructor(readonly dto: IngestPostDto) {
    super();
  }
}
