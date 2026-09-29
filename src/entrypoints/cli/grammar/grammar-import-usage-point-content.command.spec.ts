import { Logger } from '@nestjs/common';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import { GrammarImportUsagePointContentCommand } from './grammar-import-usage-point-content.command.js';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

const { readFile } = await import('node:fs/promises');
const MISSING_EGP_INDEX_RE = /egpIndex/;

const seed = {
  '2': {
    explanation: 'We use the present simple for habits.',
    examples: ['I walk to work.', 'She reads every night.'],
    uk: { explanation: 'Present simple вживаємо для звичок.' },
  },
};

describe('GrammarImportUsagePointContentCommand', () => {
  let command: GrammarImportUsagePointContentCommand;
  let flush: ReturnType<typeof vi.fn>;
  let find: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    flush = vi.fn().mockResolvedValue(undefined);
    find = vi.fn();
    command = injectOrm(new GrammarImportUsagePointContentCommand(), {
      em: { find, flush },
    });
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(seed));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('overwrites learner content and merges the uk translation', async () => {
    const point = {
      id: 'up-1',
      egpIndex: 2,
      learnerExplanation: 'Old AI text.',
      learnerExamples: ['Old.'],
      translations: { uk: { explanation: 'Старе.' }, xx: { explanation: 'x' } },
    };
    find.mockResolvedValueOnce([point]);

    await command.run([], {});

    expect(point).toMatchObject({
      learnerExplanation: seed['2'].explanation,
      learnerExamples: seed['2'].examples,
      translations: {
        uk: seed['2'].uk,
        xx: { explanation: 'x' },
      },
    });
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('writes translated examples alongside the explanation', async () => {
    const examples = ['Я ходжу на роботу пішки.', 'Вона читає щовечора.'];
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        '2': { ...seed['2'], uk: { ...seed['2'].uk, examples } },
      }),
    );
    const point = { id: 'up-1', egpIndex: 2, translations: null };
    find.mockResolvedValueOnce([point]);

    await command.run([], {});

    expect(point.translations).toEqual({
      uk: { explanation: seed['2'].uk.explanation, examples },
    });
  });

  it('rejects translated examples that do not match the examples', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        '2': {
          ...seed['2'],
          uk: { ...seed['2'].uk, examples: ['Лише один.'] },
        },
      }),
    );

    await expect(command.run([], {})).rejects.toThrow();
    expect(find).not.toHaveBeenCalled();
  });

  it('throws when the seed references an egpIndex with no matching usage point', async () => {
    find.mockResolvedValueOnce([]);

    await expect(command.run([], {})).rejects.toThrow(MISSING_EGP_INDEX_RE);
    expect(flush).not.toHaveBeenCalled();
  });

  it('rejects an entry with fewer than two examples', async () => {
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({ '2': { ...seed['2'], examples: ['Only one.'] } }),
    );

    await expect(command.run([], {})).rejects.toThrow();
    expect(find).not.toHaveBeenCalled();
  });
});
