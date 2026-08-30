import { access, readFile } from 'node:fs/promises';
import { Logger } from '@nestjs/common';
import { Option, SubCommand } from 'nest-commander';
import { IngestPostDto } from '../../../modules/post/commands/ingest-post/ingest-post.dto.js';
import { PostSourceType } from '../../../modules/post/enums/post-source-type.enum.js';
import { PostType } from '../../../modules/post/enums/post-type.enum.js';
import { PostService } from '../../../modules/post/post.service.js';
import { CliCommandRunner } from '../cli-command.runner.js';
import { CliInputError } from '../cli-input.error.js';
import { InvalidCliFlagError } from '../invalid-cli-flag.error.js';

interface IngestOptions {
  title?: string;
  type?: PostType;
  sourceType?: PostSourceType;
  attribution?: string;
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
    if (!Object.values(PostType).includes(val as PostType)) {
      throw new InvalidCliFlagError('--type');
    }
    return val as PostType;
  }

  @Option({
    flags: '-s, --source-type <sourceType>',
    description: `Source attribution type (${Object.values(PostSourceType).join('|')}), defaults to "${PostSourceType.Original}"`,
  })
  parseSourceType(val: string): PostSourceType {
    if (!Object.values(PostSourceType).includes(val as PostSourceType)) {
      throw new InvalidCliFlagError('--source-type');
    }
    return val as PostSourceType;
  }

  @Option({
    flags: '-a, --attribution <attribution>',
    description:
      'Human-readable source credit shown on the post page (PLAN.md §9). Falls back to the link when omitted.',
  })
  parseAttribution(val: string): string {
    return val;
  }

  protected async execute(
    args: string[],
    options: IngestOptions,
  ): Promise<void> {
    const [file] = args;

    // Fail fast on a bad path so a user typo reads as user error, not an
    // ENOENT infrastructure fault escaping to Sentry.
    try {
      await access(file);
    } catch {
      throw new CliInputError(`Ingest file not found: ${file}`);
    }

    const rawText = await readFile(file, 'utf-8');

    const post = await this.postService.ingest(
      IngestPostDto.create({
        rawText,
        title: options.title,
        type: options.type,
        sourceType: options.sourceType,
        attributionText: options.attribution,
      }),
    );

    this.logger.log(
      { id: post.id, format: post.source.format },
      'post ingested',
    );
  }
}
