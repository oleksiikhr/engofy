import { EntityManager } from '@mikro-orm/postgresql';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { OutboxSenderService } from '../../../../core/queue/outbox-sender.service.js';
import { QueueName } from '../../../../core/queue/queue-names.enum.js';
import { convertToDoc } from '../../converters/to-doc.converter.js';
import { detectPostSourceFormat } from '../../domain/detect-post-source-format.js';
import { generateSlug } from '../../domain/generate-slug.js';
import { splitDocIntoParts } from '../../domain/post-parts.js';
import { PostSource } from '../../embeddables/post-source.embeddable.js';
import { Post } from '../../entities/post.entity.js';
import { PostPart } from '../../entities/post-part.entity.js';
import { IngestPostCommand } from './ingest-post.command.js';

export interface PostAnnotationJobData {
  postId: string;
}

export interface PostSpacyParseJobData {
  postId: string;
}

@CommandHandler(IngestPostCommand)
export class IngestPostHandler implements ICommandHandler<IngestPostCommand> {
  constructor(
    private readonly em: EntityManager,
    private readonly outbox: OutboxSenderService,
  ) {}

  async execute(command: IngestPostCommand): Promise<Post> {
    const { rawText, title, link, type } = command.dto;
    const format = detectPostSourceFormat(rawText);

    const source = new PostSource();
    source.format = format;
    source.rawText = rawText;
    source.link = link ?? null;

    const post = new Post();
    post.source = source;
    post.title = title ?? null;
    post.type = type;
    post.slug = title ? generateSlug(title) : null;

    this.em.persist(post);

    const doc = convertToDoc(format, rawText);
    for (const spec of splitDocIntoParts(doc)) {
      const part = new PostPart();
      part.postId = post.id;
      part.blockIndex = spec.blockIndex;
      part.kind = spec.kind;
      part.body = spec.body;
      this.em.persist(part);
    }

    // spacy_parse is the pipeline entry point. It fans out on completion to
    // both downstream branches — the node-tree annotation stage (which now
    // consumes sentence_tokens) and ai_complexity → ai_grammar →
    // ai_exercises → publish (PLAN.md §5, §12).
    this.outbox.send<PostSpacyParseJobData>(
      this.em,
      QueueName.PostSpacyParse,
      { postId: post.id },
      { singletonKey: post.id },
    );

    return post;
  }
}
