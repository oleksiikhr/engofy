import { EntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AnnotatePostCommand } from './commands/annotate-post/annotate-post.command.js';
import { AssessComplexityCommand } from './commands/assess-complexity/assess-complexity.command.js';
import { GenerateExercisesCommand } from './commands/generate-exercises/generate-exercises.command.js';
import { IngestPostCommand } from './commands/ingest-post/ingest-post.command.js';
import type { IngestPostDto } from './commands/ingest-post/ingest-post.dto.js';
import { PublishPostCommand } from './commands/publish-post/publish-post.command.js';
import { RetryPostCommand } from './commands/retry-post/retry-post.command.js';
import { SpacyParsePostCommand } from './commands/spacy-parse-post/spacy-parse-post.command.js';
import { TagGrammarCommand } from './commands/tag-grammar/tag-grammar.command.js';
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

  async spacyParse(postId: string): Promise<void> {
    await this.commandBus.execute(new SpacyParsePostCommand(postId));

    await this.em.flush();
  }

  async assessComplexity(postId: string): Promise<void> {
    await this.commandBus.execute(new AssessComplexityCommand(postId));

    await this.em.flush();
  }

  async tagGrammar(postId: string): Promise<void> {
    await this.commandBus.execute(new TagGrammarCommand(postId));

    await this.em.flush();
  }

  async generateExercises(postId: string): Promise<void> {
    await this.commandBus.execute(new GenerateExercisesCommand(postId));

    await this.em.flush();
  }

  async publish(postId: string): Promise<void> {
    await this.commandBus.execute(new PublishPostCommand(postId));

    await this.em.flush();
  }

  async retry(postId: string): Promise<void> {
    await this.commandBus.execute(new RetryPostCommand(postId));

    await this.em.flush();
  }
}
