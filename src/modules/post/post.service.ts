import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AnnotatePostCommand } from './commands/annotate-post/annotate-post.command.js';
import { IngestPostCommand } from './commands/ingest-post/ingest-post.command.js';
import type { IngestPostDto } from './commands/ingest-post/ingest-post.dto.js';
import type { Post } from './entities/post.entity.js';

@Injectable()
export class PostService {
  constructor(
    private readonly em: EntityManager,
    private readonly commandBus: CommandBus,
  ) {}

  async ingest(dto: IngestPostDto): Promise<Post> {
    const post = await this.commandBus.execute(new IngestPostCommand(dto));

    await this.em.flush();

    return post;
  }

  async annotate(postId: string): Promise<void> {
    await this.commandBus.execute(new AnnotatePostCommand(postId));

    await this.em.flush();
  }
}
