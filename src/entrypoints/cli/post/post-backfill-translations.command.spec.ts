import { Logger } from '@nestjs/common';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import { ContentLanguage } from '../../../modules/post/enums/content-language.enum.js';
import { PostPipelineStage } from '../../../modules/post/enums/post-pipeline-stage.enum.js';
import { InvalidCliFlagError } from '../invalid-cli-flag.error.js';
import { PostBackfillTranslationsCommand } from './post-backfill-translations.command.js';

describe('PostBackfillTranslationsCommand', () => {
  let command: PostBackfillTranslationsCommand;
  let enrichLexicon: ReturnType<typeof vi.fn>;
  let enrichGrammar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    enrichLexicon = vi.fn().mockResolvedValue(undefined);
    enrichGrammar = vi.fn().mockResolvedValue(undefined);
    const find = vi.fn(async (_entity, where: { stage: PostPipelineStage }) =>
      where.stage === PostPipelineStage.Enrichment
        ? [{ postId: 'p-1' }, { postId: 'p-2' }]
        : [{ postId: 'p-1' }],
    );
    command = injectOrm(
      new PostBackfillTranslationsCommand({
        enrichLexicon,
        enrichGrammar,
      } as never),
      { em: { find } },
    );
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parseLang accepts a content language and rejects an unknown one', () => {
    expect(command.parseLang('uk')).toBe(ContentLanguage.Uk);
    expect(() => command.parseLang('xx')).toThrow(InvalidCliFlagError);
  });

  it('re-runs both stages for the named language on every completed post', async () => {
    await command.run([], { lang: ContentLanguage.Uk });

    expect(enrichLexicon.mock.calls).toEqual([
      ['p-1', [ContentLanguage.Uk]],
      ['p-2', [ContentLanguage.Uk]],
    ]);
    expect(enrichGrammar.mock.calls).toEqual([['p-1', [ContentLanguage.Uk]]]);
  });

  it('defaults to every enrichment language', async () => {
    await command.run([], {});

    expect(enrichLexicon).toHaveBeenCalledWith(
      'p-1',
      Object.values(ContentLanguage),
    );
  });
});
