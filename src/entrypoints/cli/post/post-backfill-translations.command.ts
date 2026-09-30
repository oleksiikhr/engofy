import { Logger } from '@nestjs/common';
import { Option, SubCommand } from 'nest-commander';
import { ENRICHMENT_LANGUAGES } from '../../../modules/post/domain/content-translations.js';
import { PostPipelineRun } from '../../../modules/post/entities/post-pipeline-run.entity.js';
import { ContentLanguage } from '../../../modules/post/enums/content-language.enum.js';
import { PostPipelineRunStatus } from '../../../modules/post/enums/post-pipeline-run-status.enum.js';
import { PostPipelineStage } from '../../../modules/post/enums/post-pipeline-stage.enum.js';
import { PostService } from '../../../modules/post/post.service.js';
import { CliCommandRunner } from '../cli-command.runner.js';
import { InvalidCliFlagError } from '../invalid-cli-flag.error.js';

interface BackfillOptions {
  lang?: ContentLanguage;
}

// Fills a language's missing word/phrase and grammar translations for posts
// whose enrichment stages already completed (they only ran for the languages
// that existed then). Row-level gap-fill: a row already translated is never
// re-billed. Run it after adding a language (docs/adding-a-language.md).
@SubCommand({
  name: 'backfill-translations',
  description:
    'Fill missing translations for already-enriched posts (real AI calls)',
})
export class PostBackfillTranslationsCommand extends CliCommandRunner<BackfillOptions> {
  private readonly logger = new Logger(this.constructor.name);

  constructor(private readonly postService: PostService) {
    super();
  }

  @Option({
    flags: '-l, --lang <lang>',
    description: `Language to fill (${Object.values(ContentLanguage).join('|')}), defaults to every enrichment language`,
  })
  parseLang(val: string): ContentLanguage {
    const lang = Object.values(ContentLanguage).find((l) => l === val);
    if (!lang) {
      throw new InvalidCliFlagError('--lang');
    }
    return lang;
  }

  protected async execute(
    _args: string[],
    options: BackfillOptions = {},
  ): Promise<void> {
    const languages = options.lang ? [options.lang] : ENRICHMENT_LANGUAGES;

    const lexiconPostIds = await this.completedPostIds(
      PostPipelineStage.Enrichment,
    );
    for (const postId of lexiconPostIds) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — one post's AI calls at a time.
      await this.postService.enrichLexicon(postId, languages);
    }

    const grammarPostIds = await this.completedPostIds(
      PostPipelineStage.GrammarEnrichment,
    );
    for (const postId of grammarPostIds) {
      // biome-ignore lint/performance/noAwaitInLoops: sequential on purpose — one post's AI calls at a time.
      await this.postService.enrichGrammar(postId, languages);
    }

    this.logger.log(
      {
        languages,
        lexiconPosts: lexiconPostIds.length,
        grammarPosts: grammarPostIds.length,
      },
      'Translations backfilled',
    );
  }

  private async completedPostIds(stage: PostPipelineStage): Promise<string[]> {
    const runs = await this.orm.em.find(
      PostPipelineRun,
      { stage, status: PostPipelineRunStatus.Completed },
      { fields: ['postId'] },
    );
    return runs.map((run) => run.postId);
  }
}
