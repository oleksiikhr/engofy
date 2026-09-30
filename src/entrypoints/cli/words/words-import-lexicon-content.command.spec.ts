import type { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import { WordsImportLexiconContentCommand } from './words-import-lexicon-content.command.js';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
vi.mock('../../../modules/post/domain/upsert-word-definition.js', () => ({
  upsertWordDefinition: vi.fn(),
}));

const { readFile } = await import('node:fs/promises');
const { upsertWordDefinition } = await import(
  '../../../modules/post/domain/upsert-word-definition.js'
);

const entry = {
  definition: 'A person who draws maps.',
  example: 'The cartographer drew the coast.',
  cefrLevel: 'C1',
  translations: { uk: { translation: 'картограф' } },
};

describe('WordsImportLexiconContentCommand', () => {
  let command: WordsImportLexiconContentCommand;
  let flush: ReturnType<typeof vi.fn>;
  let findOneOrFail: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    flush = vi.fn().mockResolvedValue(undefined);
    findOneOrFail = vi.fn();
    const em = { flush, findOneOrFail } as unknown as EntityManager;
    command = injectOrm(new WordsImportLexiconContentCommand(em), { em });
    vi.mocked(upsertWordDefinition).mockResolvedValue({
      wordId: 'w-1',
      wordDefinitionId: 'd-1',
    });
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the entry onto the lemma + part of speech, keeping other languages', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ cartographer: { noun: entry } }),
    );
    const definition = {
      id: 'd-1',
      definition: null,
      translations: { xx: { translation: 'x' } },
    };
    findOneOrFail.mockResolvedValue(definition);

    await command.run([], {});

    expect(upsertWordDefinition).toHaveBeenCalledWith(
      expect.anything(),
      'cartographer',
      'noun',
    );
    expect(definition).toMatchObject({
      definition: entry.definition,
      exampleSentence: entry.example,
      cefrLevel: 'C1',
      translations: {
        uk: { translation: 'картограф' },
        xx: { translation: 'x' },
      },
    });
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown part of speech', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ cartographer: { gerund: entry } }),
    );

    await expect(command.run([], {})).rejects.toThrow();
    expect(upsertWordDefinition).not.toHaveBeenCalled();
  });

  it('rejects an entry without a translation', async () => {
    const { translations: _t, ...noTranslation } = entry;
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ cartographer: { noun: noTranslation } }),
    );

    await expect(command.run([], {})).rejects.toThrow();
  });
});
