import { Logger } from '@nestjs/common';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import { WordsImportFrequencyCommand } from './words-import-frequency.command.js';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

const { readFile } = await import('node:fs/promises');

describe('WordsImportFrequencyCommand', () => {
  let command: WordsImportFrequencyCommand;
  let flush: ReturnType<typeof vi.fn>;
  let find: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    flush = vi.fn().mockResolvedValue(undefined);
    find = vi.fn();
    command = injectOrm(new WordsImportFrequencyCommand(), {
      em: { find, flush },
    });
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('assigns the rank to matching lemmas and nulls the rest', async () => {
    vi.mocked(readFile).mockResolvedValue('the\ngo\nhouse\n');
    const known = { lemma: 'Go', frequencyRank: null as number | null };
    const stale = { lemma: 'zzz', frequencyRank: 999 as number | null };
    find.mockResolvedValue([known, stale]);

    await command.run([], {});

    expect(known.frequencyRank).toBe(2);
    expect(stale.frequencyRank).toBeNull();
    expect(flush).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      { listSize: 3, words: 2, ranked: 1, unranked: 1 },
      'word frequencies imported',
    );
  });
});
