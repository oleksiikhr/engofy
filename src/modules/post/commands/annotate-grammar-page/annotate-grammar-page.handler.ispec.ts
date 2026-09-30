import { factories } from '../../../../../test/factories/factories.js';
import { FakeNlpClient } from '../../../../../test/fakes/nlp.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { NLP_CLIENT } from '../../../../core/nlp/nlp-client.port.js';
import { lexBlockHash } from '../../domain/lex-block.js';
import {
  GrammarPageLexBlock,
  type GrammarPageLexSpan,
} from '../../entities/grammar-page-lex-block.entity.js';
import { Phrase } from '../../entities/phrase.entity.js';
import { Word } from '../../entities/word.entity.js';
import { WordDefinition } from '../../entities/word-definition.entity.js';
import { PostModule } from '../../post.module.js';
import { AnnotateGrammarPageCommand } from './annotate-grammar-page.command.js';

// Rare words, so the real word-frequency list never drops them as common.
const NLP_OVERRIDES = {
  cartographer: { pos: 'NOUN' },
  sketched: { pos: 'VERB', lemma: 'sketch' },
  meticulous: { pos: 'ADJ' },
  the: { pos: 'DET' },
};

const FIRST = 'The cartographer sketched';
const asBlock = (
  text: string,
  targets: { start: number; end: number }[] = [],
) => ({
  text,
  targets,
});

const wordDefinitionIdOf = (span: GrammarPageLexSpan | undefined) =>
  span && 'wordDefinitionId' in span ? span.wordDefinitionId : undefined;
const SECOND = 'meticulous cartographer';
const THIRD = 'The meticulous cartographer';

describe('AnnotateGrammarPageHandler', () => {
  const fakeNlp = new FakeNlpClient(NLP_OVERRIDES);
  const suite = createIntegrationSuite(
    { imports: [PostModule] },
    {
      builderHook: (builder) =>
        builder.overrideProvider(NLP_CLIENT).useValue(fakeNlp),
    },
  );

  async function createConstruction(): Promise<string> {
    const em = suite.orm.em;
    const category = factories(em).grammarCategory.makeOne();
    const construction = factories(em).grammarConstruction.makeOne({
      categoryId: category.id,
      slug: 'lex-test',
    });
    await em.flush();
    return construction.id;
  }

  it('links content words of every block to a word definition', async () => {
    const constructionId = await createConstruction();

    const view = await suite.command(
      new AnnotateGrammarPageCommand('lex-test', [
        asBlock(FIRST),
        asBlock(SECOND),
      ]),
    );

    expect(view).toEqual({ blocks: 2, parsed: 2, removed: 0 });
    const em = suite.orm.em;
    const first = await em.findOneOrFail(GrammarPageLexBlock, {
      constructionId,
      textHash: lexBlockHash(FIRST),
    });
    expect(first.spans.map((span) => [span.start, span.end])).toEqual([
      [4, 16],
      [17, 25],
    ]);
    const sketch = await em.findOneOrFail(Word, { lemma: 'sketch' });
    const definition = await em.findOneOrFail(WordDefinition, {
      id: wordDefinitionIdOf(first.spans[1]),
    });
    expect(definition).toMatchObject({ wordId: sketch.id, pos: 'verb' });
    // The same lemma + part of speech in another block is the same sense.
    const second = await em.findOneOrFail(GrammarPageLexBlock, {
      constructionId,
      textHash: lexBlockHash(SECOND),
    });
    expect(wordDefinitionIdOf(second.spans[1])).toBe(
      wordDefinitionIdOf(first.spans[0]),
    );
  });

  it('parses only new blocks and removes the ones the page lost', async () => {
    const constructionId = await createConstruction();
    await suite.command(
      new AnnotateGrammarPageCommand('lex-test', [
        asBlock(FIRST),
        asBlock(SECOND),
      ]),
    );
    const callsBefore = fakeNlp.callCount;

    const view = await suite.command(
      new AnnotateGrammarPageCommand('lex-test', [
        asBlock(FIRST),
        asBlock(THIRD),
      ]),
    );

    expect(view).toEqual({ blocks: 2, parsed: 1, removed: 1 });
    expect(fakeNlp.callCount - callsBefore).toBe(1);
    const hashes = (
      await suite.orm.em.find(GrammarPageLexBlock, { constructionId })
    )
      .map((row) => row.textHash)
      .sort();
    expect(hashes).toEqual([lexBlockHash(FIRST), lexBlockHash(THIRD)].sort());
  });

  it('re-parses every kept block on refresh', async () => {
    const constructionId = await createConstruction();
    await suite.command(
      new AnnotateGrammarPageCommand('lex-test', [
        asBlock(FIRST),
        asBlock(SECOND),
      ]),
    );
    const callsBefore = fakeNlp.callCount;

    const view = await suite.command(
      new AnnotateGrammarPageCommand(
        'lex-test',
        [asBlock(FIRST), asBlock(SECOND)],
        { literal: [], phrasalVerbs: [] },
        true,
      ),
    );

    expect(view).toEqual({ blocks: 2, parsed: 2, removed: 0 });
    expect(fakeNlp.callCount - callsBefore).toBe(2);
    expect(
      await suite.orm.em.count(GrammarPageLexBlock, { constructionId }),
    ).toBe(2);
  });

  it('links a function word inside a target range with its own part of speech', async () => {
    const constructionId = await createConstruction();

    await suite.command(
      new AnnotateGrammarPageCommand('lex-test', [
        asBlock(FIRST, [{ start: 0, end: 3 }]),
      ]),
    );

    const row = await suite.orm.em.findOneOrFail(GrammarPageLexBlock, {
      constructionId,
      textHash: lexBlockHash(FIRST),
    });
    expect(row.spans.map((span) => [span.start, span.end])).toEqual([
      [0, 3],
      [4, 16],
      [17, 25],
    ]);
    const definition = await suite.orm.em.findOneOrFail(WordDefinition, {
      id: wordDefinitionIdOf(row.spans[0]),
    });
    expect(definition.pos).toBe('determiner');
  });

  it('links a listed phrase instead of the words inside it', async () => {
    const constructionId = await createConstruction();

    await suite.command(
      new AnnotateGrammarPageCommand('lex-test', [asBlock(THIRD)], {
        literal: ['meticulous cartographer'],
        phrasalVerbs: [],
      }),
    );

    const block = await suite.orm.em.findOneOrFail(GrammarPageLexBlock, {
      constructionId,
      textHash: lexBlockHash(THIRD),
    });
    expect(block.spans).toHaveLength(1);
    const phrase = await suite.orm.em.findOneOrFail(Phrase, {
      phraseText: 'meticulous cartographer',
    });
    expect(block.spans[0]).toEqual({ start: 4, end: 27, phraseId: phrase.id });
  });

  it('rejects an unknown construction', async () => {
    await expect(
      suite.command(
        new AnnotateGrammarPageCommand('no-such-page', [asBlock(FIRST)]),
      ),
    ).rejects.toThrow('Grammar construction not found');
  });
});
