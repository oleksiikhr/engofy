import { readFile } from 'node:fs/promises';
import { Logger } from '@nestjs/common';
import { Option, SubCommand } from 'nest-commander';
import { IngestContentDto } from '../../../modules/content/commands/ingest-content/ingest-content.dto.js';
import { ContentService } from '../../../modules/content/content.service.js';
import { ContentType } from '../../../modules/content/enums/content-type.enum.js';
import { CliCommandRunner } from '../cli-command.runner.js';

interface IngestOptions {
  title?: string;
  type?: ContentType;
}

@SubCommand({
  name: 'ingest',
  description:
    'Ingest a text/markdown/html file as new Content (source format is auto-detected)',
  arguments: '<file>',
  argsDescription: { file: 'Path to the file to ingest' },
})
export class ContentIngestCommand extends CliCommandRunner<IngestOptions> {
  private readonly logger = new Logger(this.constructor.name);

  constructor(private readonly content: ContentService) {
    super();
  }

  @Option({
    flags: '-t, --title <title>',
    description: 'Optional title for the ingested content',
  })
  parseTitle(val: string): string {
    return val;
  }

  @Option({
    flags: '-y, --type <type>',
    description: `Content type (${Object.values(ContentType).join('|')}), defaults to "${ContentType.Post}"`,
  })
  parseType(val: string): ContentType {
    return val as ContentType;
  }

  protected async execute(
    args: string[],
    options: IngestOptions,
  ): Promise<void> {
    const [file] = args;
    const rawText = await readFile(file, 'utf-8');

    const content = await this.content.ingest(
      IngestContentDto.create({
        rawText,
        title: options.title,
        type: options.type,
      }),
    );

    this.logger.log(
      { id: content.id, format: content.source.format },
      'content ingested',
    );
  }
}
