import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Inject, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Option, SubCommand } from 'nest-commander';
import { z } from 'zod';
import AppConfig from '../../../core/config/app.config.js';
import {
  parsePhraseContentSeedFile,
  phraseLists,
} from '../../../modules/post/domain/lexicon-content-seed.js';
import { PostService } from '../../../modules/post/post.service.js';
import { CliCommandRunner } from '../cli-command.runner.js';

interface AnnotatePagesOptions {
  webUrl?: string;
  refresh?: boolean;
}

// The hand-listed phrases linked wherever they occur (words
// import-phrase-content seeds their dictionary entries).
const PHRASES_PATH = join(process.cwd(), 'assets', 'phrase-content.json');

// apps/web `src/pages/grammar/lex-blocks.json.ts`: every handcrafted page's
// text blocks, keyed by construction slug.
const LexBlocksResponseSchema = z.object({
  pages: z.record(z.string(), z.array(z.string())),
});

// Makes every handcrafted grammar page's words clickable: pulls the pages'
// text blocks from the running web app and links their words to the
// dictionary (spaCy, no AI — see AnnotateGrammarPageHandler). Re-run after
// editing a page; unchanged blocks are not re-parsed.
@SubCommand({
  name: 'annotate-pages',
  description:
    'Link the words of every handcrafted grammar page to the dictionary (needs the web app running)',
})
export class GrammarAnnotatePagesCommand extends CliCommandRunner<AnnotatePagesOptions> {
  private readonly logger = new Logger(this.constructor.name);

  constructor(
    private readonly postService: PostService,
    @Inject(AppConfig.KEY)
    private readonly appConfig: ConfigType<typeof AppConfig>,
  ) {
    super();
  }

  @Option({
    flags: '-w, --web-url <url>',
    description: 'Base URL of the web app, defaults to PUBLIC_URL',
  })
  parseWebUrl(val: string): string {
    return val;
  }

  @Option({
    flags: '-r, --refresh',
    description:
      'Re-parse every block, not only new ones (after the word rule or assets/phrase-content.json changed)',
  })
  parseRefresh(): boolean {
    return true;
  }

  protected async execute(
    _args: string[],
    options: AnnotatePagesOptions = {},
  ): Promise<void> {
    const base = options.webUrl ?? this.appConfig.publicUrl;
    const response = await fetch(new URL('/grammar/lex-blocks.json', base));
    if (!response.ok) {
      throw new Error(
        `GET ${response.url} failed with ${response.status} — is the web app running?`,
      );
    }
    const { pages } = LexBlocksResponseSchema.parse(await response.json());
    if (Object.keys(pages).length === 0) {
      throw new Error(`GET ${response.url} listed no grammar pages`);
    }
    const phrases = phraseLists(
      parsePhraseContentSeedFile(
        JSON.parse(await readFile(PHRASES_PATH, 'utf-8')),
      ),
    );

    for (const [slug, blocks] of Object.entries(pages)) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — one page (and its nlp-service calls) at a time.
      const view = await this.postService.annotateGrammarPage(
        slug,
        blocks,
        phrases,
        options.refresh ?? false,
      );
      this.logger.log({ slug, ...view }, 'Grammar page annotated');
    }
  }
}
