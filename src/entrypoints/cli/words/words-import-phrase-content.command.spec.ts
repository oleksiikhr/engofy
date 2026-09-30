import type { EntityManager } from '@mikro-orm/postgresql';
import { Logger } from '@nestjs/common';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import { WordsImportPhraseContentCommand } from './words-import-phrase-content.command.js';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
vi.mock('../../../modules/post/domain/upsert-phrase-id.js', () => ({
  upsertPhraseId: vi.fn(),
}));

const { readFile } = await import('node:fs/promises');
const { upsertPhraseId } = await import(
  '../../../modules/post/domain/upsert-phrase-id.js'
);

const entry = {
  definition: 'To stop trying.',
  example: 'Never give up.',
  cefrLevel: 'B1',
  translations: { uk: { translation: 'здаватися' } },
};

describe('WordsImportPhraseContentCommand', () => {
  let flush: ReturnType<typeof vi.fn>;
  let findOneOrFail: ReturnType<typeof vi.fn>;
  let command: WordsImportPhraseContentCommand;

  beforeEach(() => {
    vi.clearAllMocks();
    flush = vi.fn().mockResolvedValue(undefined);
    findOneOrFail = vi.fn();
    const em = { flush, findOneOrFail } as unknown as EntityManager;
    command = injectOrm(new WordsImportPhraseContentCommand(em), { em });
    vi.mocked(upsertPhraseId).mockResolvedValue('p-1');
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the entry onto the phrase, creating it with its type', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ 'give up': { ...entry, type: 'phrasal_verb' } }),
    );
    const phrase = { id: 'p-1', translations: null };
    findOneOrFail.mockResolvedValue(phrase);

    await command.run([], {});

    expect(upsertPhraseId).toHaveBeenCalledWith(
      expect.anything(),
      'give up',
      'phrasal_verb',
    );
    expect(phrase).toMatchObject({
      definition: entry.definition,
      exampleSentence: entry.example,
      cefrLevel: 'B1',
      translations: { uk: { translation: 'здаватися' } },
    });
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('rejects a phrase that is not lowercase', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ 'Give Up': entry }));

    await expect(command.run([], {})).rejects.toThrow();
    expect(upsertPhraseId).not.toHaveBeenCalled();
  });
});
