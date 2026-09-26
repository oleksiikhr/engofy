import { Logger } from '@nestjs/common';
import { injectOrm } from '../../../../test/helpers/orm.helper.js';
import { ExerciseType } from '../../../modules/post/enums/exercise-type.enum.js';
import { GrammarImportUsagePointExercisesCommand } from './grammar-import-usage-point-exercises.command.js';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));

const { readFile } = await import('node:fs/promises');
const MISSING_EGP_INDEX_RE = /egpIndex/;

const seed = {
  '2': [
    {
      type: ExerciseType.FillBlank,
      payload: {
        prompt: 'I ___ to work.',
        answer: 'go',
        options: ['go', 'goes'],
      },
    },
    {
      type: ExerciseType.MultipleChoice,
      payload: {
        prompt: 'She ___ football.',
        options: ['play', 'plays'],
        answerIndex: 1,
      },
    },
  ],
};

describe('GrammarImportUsagePointExercisesCommand', () => {
  let command: GrammarImportUsagePointExercisesCommand;
  let persist: ReturnType<typeof vi.fn>;
  let flush: ReturnType<typeof vi.fn>;
  let find: ReturnType<typeof vi.fn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    persist = vi.fn();
    flush = vi.fn().mockResolvedValue(undefined);
    find = vi.fn();
    command = injectOrm(new GrammarImportUsagePointExercisesCommand(), {
      em: { find, persist, flush },
    });
    logSpy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(seed));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports every exercise for a usage point that has none yet', async () => {
    find
      .mockResolvedValueOnce([{ id: 'up-1', egpIndex: 2 }]) // usage points
      .mockResolvedValueOnce([]); // existing exercises

    await command.run([], {});

    expect(persist).toHaveBeenCalledTimes(2);
    expect(persist.mock.calls[0][0]).toMatchObject({
      usagePointId: 'up-1',
      type: ExerciseType.FillBlank,
      payload: seed['2'][0].payload,
    });
    expect(flush).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledWith(
      {
        egpIndexesInSeed: 1,
        usagePointsAlreadySeeded: 0,
        usagePointsImported: 1,
        exercisesImported: 2,
      },
      'Usage-point exercise bank imported',
    );
  });

  it('skips a usage point that already has exercises', async () => {
    find
      .mockResolvedValueOnce([{ id: 'up-1', egpIndex: 2 }])
      .mockResolvedValueOnce([{ usagePointId: 'up-1' }]);

    await command.run([], {});

    expect(persist).not.toHaveBeenCalled();
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('throws when the seed references an egpIndex with no matching usage point', async () => {
    find.mockResolvedValueOnce([]);

    await expect(command.run([], {})).rejects.toThrow(MISSING_EGP_INDEX_RE);
    expect(persist).not.toHaveBeenCalled();
  });
});
