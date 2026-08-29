import { Command } from '@nestjs/cqrs';
import type { Post } from '../../entities/post.entity.js';
import type { IngestPostDto } from './ingest-post.dto.js';

export class IngestPostCommand extends Command<Post> {
  constructor(readonly dto: IngestPostDto) {
    super();
  }
}
