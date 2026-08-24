import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { OutboxSenderService } from '../../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import { convertToDoc } from '../../converters/to-doc.converter.js';
import { splitDocIntoParts } from '../../domain/content-parts.js';
import { detectContentSourceFormat } from '../../domain/detect-content-source-format.js';
import { generateSlug } from '../../domain/generate-slug.js';
import { ContentSource } from '../../embeddables/content-source.embeddable.js';
import { Content } from '../../entities/content.entity.js';
import { ContentPart } from '../../entities/content-part.entity.js';
import { IngestContentCommand } from './ingest-content.command.js';

export interface ContentAnnotationJobData {
  contentId: string;
}

@CommandHandler(IngestContentCommand)
export class IngestContentHandler
  implements ICommandHandler<IngestContentCommand>
{
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxSenderService,
  ) {}

  async execute(command: IngestContentCommand): Promise<Content> {
    const { rawText, title, link, type } = command.dto;
    const format = detectContentSourceFormat(rawText);

    const source = new ContentSource();
    source.format = format;
    source.rawText = rawText;
    source.link = link ?? null;

    const content = new Content();
    content.source = source;
    content.title = title ?? null;
    content.type = type;
    content.slug = title ? generateSlug(title) : null;

    this.em.persist(content);

    const doc = convertToDoc(format, rawText);
    for (const spec of splitDocIntoParts(doc)) {
      const part = new ContentPart();
      part.contentId = content.id;
      part.blockIndex = spec.blockIndex;
      part.kind = spec.kind;
      part.body = spec.body;
      this.em.persist(part);
    }

    this.outbox.send<ContentAnnotationJobData>(
      this.em,
      QueueName.ContentAnnotation,
      { contentId: content.id },
      { singletonKey: content.id },
    );

    return content;
  }
}
