import { readFile } from 'node:fs/promises';
import { Logger } from '@nestjs/common';
import { Option, SubCommand } from 'nest-commander';
import { IngestPostDto } from '../../../modules/post/commands/ingest-post/ingest-post.dto.js';
import { PostType } from '../../../modules/post/enums/post-type.enum.js';
import { PostService } from '../../../modules/post/post.service.js';
import { CliCommandRunner } from '../cli-command.runner.js';

interface IngestOptions {
  title?: string;
  type?: PostType;
}

@SubCommand({
  name: 'ingest',
  description:
    'Ingest a text/markdown/html file as new Post (source format is auto-detected)',
  arguments: '<file>',
  argsDescription: { file: 'Path to the file to ingest' },
})
export class PostIngestCommand extends CliCommandRunner<IngestOptions> {
  private readonly logger = new Logger(this.constructor.name);

  constructor(private readonly postService: PostService) {
    super();
  }

  @Option({
    flags: '-t, --title <title>',
    description: 'Optional title for the ingested post',
  })
  parseTitle(val: string): string {
    return val;
  }

  @Option({
    flags: '-y, --type <type>',
    description: `Post type (${Object.values(PostType).join('|')}), defaults to "${PostType.Post}"`,
  })
  parseType(val: string): PostType {
    return val as PostType;
  }

  protected async execute(
    args: string[],
    options: IngestOptions,
  ): Promise<void> {
    const [file] = args;
    const rawText = await readFile(file, 'utf-8');

    const post = await this.postService.ingest(
      IngestPostDto.create({
        rawText,
        title: options.title,
        type: options.type,
      }),
    );

    this.logger.log(
      { id: post.id, format: post.source.format },
      'post ingested',
    );
  }
}
