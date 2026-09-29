import { factories } from '../../../../../test/factories/factories.js';
import { FakeNlpClient } from '../../../../../test/fakes/nlp.fake.js';
import { createIntegrationSuite } from '../../../../../test/setup/int-suite.helper.js';
import { NLP_CLIENT } from '../../../../core/nlp/nlp-client.port.js';
import { lexBlockHash } from '../../domain/lex-block.js';
import { GrammarPageLexBlock } from '../../entities/grammar-page-lex-block.entity.js';
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
      new AnnotateGrammarPageCommand('lex-test', [FIRST, SECOND]),
    );

    expect(view).toEqual({ blocks: 2, parsed: 2, removed: 0 });
    const em = suite.orm.em;
    const first = await em.findOneOrFail(GrammarPageLexBlock, {
      constructionId,
      textHash: lexBlockHash(FIRST),
    });
    expect(first.words.map((w) => [w.start, w.end])).toEqual([
      [4, 16],
      [17, 25],
    ]);
    const sketch = await em.findOneOrFail(Word, { lemma: 'sketch' });
    const definition = await em.findOneOrFail(WordDefinition, {
      id: first.words[1]?.wordDefinitionId,
    });
    expect(definition).toMatchObject({ wordId: sketch.id, pos: 'verb' });
    // The same lemma + part of speech in another block is the same sense.
    const second = await em.findOneOrFail(GrammarPageLexBlock, {
      constructionId,
      textHash: lexBlockHash(SECOND),
    });
    expect(second.words[1]?.wordDefinitionId).toBe(
      first.words[0]?.wordDefinitionId,
    );
  });

  it('parses only new blocks and removes the ones the page lost', async () => {
    const constructionId = await createConstruction();
    await suite.command(
      new AnnotateGrammarPageCommand('lex-test', [FIRST, SECOND]),
    );
    const callsBefore = fakeNlp.callCount;

    const view = await suite.command(
      new AnnotateGrammarPageCommand('lex-test', [FIRST, THIRD]),
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
      new AnnotateGrammarPageCommand('lex-test', [FIRST, SECOND]),
    );
    const callsBefore = fakeNlp.callCount;

    const view = await suite.command(
      new AnnotateGrammarPageCommand('lex-test', [FIRST, SECOND], true),
    );

    expect(view).toEqual({ blocks: 2, parsed: 2, removed: 0 });
    expect(fakeNlp.callCount - callsBefore).toBe(2);
    expect(
      await suite.orm.em.count(GrammarPageLexBlock, { constructionId }),
    ).toBe(2);
  });

  it('rejects an unknown construction', async () => {
    await expect(
      suite.command(new AnnotateGrammarPageCommand('no-such-page', [FIRST])),
    ).rejects.toThrow('Grammar construction not found');
  });
});
