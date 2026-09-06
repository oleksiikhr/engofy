import { Logger } from '@nestjs/common';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import { GrammarImportEgpCommand } from './grammar-import-egp.command.js';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

const { readFile } = await import('node:fs/promises');

const records = [
  {
    index: 1,
    category: 'PRESENT',
    subcategory: 'simple',
    level: 'A1',
    guideword: "FORM: AFFIRMATIVE WITH 'DO'",
    can_do: 'Can form the present simple.',
    example: 'I work here.',
  },
  {
    index: 2,
    category: 'PRESENT',
    subcategory: 'simple',
    level: 'A1',
    guideword: 'USE: HABITS AND GENERAL FACTS',
    can_do: 'Can talk about habits.',
    example: 'I go by bus.',
  },
];

describe('GrammarImportEgpCommand', () => {
  let command: GrammarImportEgpCommand;
  let persist: ReturnType<typeof vi.fn>;
  let flush: ReturnType<typeof vi.fn>;
  let find: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    persist = vi.fn();
    flush = vi.fn().mockResolvedValue(undefined);
    find = vi.fn();
    command = injectOrm(new GrammarImportEgpCommand(), {
      em: { find, persist, flush },
    });
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(records));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates category, construction and only the USE record as a usage point', async () => {
    find.mockResolvedValue([]);

    await command.run([], {});

    expect(persist).toHaveBeenCalledTimes(3);
    const point = persist.mock.calls[2][0];
    expect(point).toMatchObject({
      egpIndex: 2,
      guideword: 'USE: HABITS AND GENERAL FACTS',
      canDoStatement: 'Can talk about habits.',
    });
    expect(flush).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      {
        records: 2,
        categories: 1,
        constructions: 1,
        usagePoints: 1,
        skipped: 1,
      },
      'EGP imported',
    );
  });

  it('updates an existing usage point matched by egpIndex instead of inserting', async () => {
    const existing = { egpIndex: 2, guideword: 'stale', canDoStatement: 'old' };
    find
      .mockResolvedValueOnce([]) // categories
      .mockResolvedValueOnce([]) // constructions
      .mockResolvedValueOnce([existing]); // usage points

    await command.run([], {});

    // category + construction only — no new usage point
    expect(persist).toHaveBeenCalledTimes(2);
    expect(existing.guideword).toBe('USE: HABITS AND GENERAL FACTS');
    expect(existing.canDoStatement).toBe('Can talk about habits.');
  });
});
