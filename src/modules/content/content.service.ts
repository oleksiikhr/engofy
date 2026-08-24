import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AnnotateContentCommand } from './commands/annotate-content/annotate-content.command.js';
import { IngestContentCommand } from './commands/ingest-content/ingest-content.command.js';
import type { IngestContentDto } from './commands/ingest-content/ingest-content.dto.js';
import type { Content } from './entities/content.entity.js';

@Injectable()
export class ContentService {
  constructor(
    private readonly em: EntityManager,
    private readonly commandBus: CommandBus,
  ) {}

  async ingest(dto: IngestContentDto): Promise<Content> {
    const content = await this.commandBus.execute(
      new IngestContentCommand(dto),
    );

    await this.em.flush();

    return content;
  }

  async annotate(contentId: string): Promise<void> {
    await this.commandBus.execute(new AnnotateContentCommand(contentId));

    await this.em.flush();
  }
}
