import { Logger } from '@nestjs/common';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import { GrammarImportIrregularVerbsCommand } from './grammar-import-irregular-verbs.command.js';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

const { readFile } = await import('node:fs/promises');

const list = JSON.stringify([
  {
    base_form: 'go',
    past_simple: ['went'],
    past_participle: ['gone'],
    cefr_level: 'A1',
  },
  {
    base_form: 'Sing',
    past_simple: ['sang'],
    past_participle: ['sung'],
    cefr_level: 'A1',
  },
]);

describe('GrammarImportIrregularVerbsCommand', () => {
  let command: GrammarImportIrregularVerbsCommand;
  let persist: ReturnType<typeof vi.fn>;
  let flush: ReturnType<typeof vi.fn>;
  let find: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    persist = vi.fn();
    flush = vi.fn().mockResolvedValue(undefined);
    // "sing" already exists, in a different case — must be skipped.
    find = vi.fn().mockResolvedValue([{ lemma: 'sing' }]);
    command = injectOrm(new GrammarImportIrregularVerbsCommand(), {
      em: { find, persist, flush },
    });
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists only the base forms not already in words, then flushes once', async () => {
    vi.mocked(readFile).mockResolvedValue(list);

    await command.run([], {});

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist.mock.calls[0][0]).toMatchObject({ lemma: 'go' });
    expect(flush).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      { total: 2, created: 1, skipped: 1 },
      'irregular verbs imported',
    );
  });
});
