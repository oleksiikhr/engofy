import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ExerciseType } from '../enums/exercise-type.enum.js';
import { parseEgpRecords, usagePointRecords } from './egp.js';
import { parseUsagePointExerciseSeedFile } from './usage-point-exercise-seed.js';

const BLANK_RE = /exactly one blank/;

const fillBlank = {
  type: ExerciseType.FillBlank,
  payload: {
    prompt: 'I ____ to work by bus.',
    answer: 'go',
    options: ['go', 'goes'],
  },
};
const multipleChoice = {
  type: ExerciseType.MultipleChoice,
  payload: {
    prompt: 'She ____ football.',
    options: ['play', 'plays'],
    answerIndex: 1,
  },
};
const reorder = {
  type: ExerciseType.Reorder,
  payload: {
    scrambled: ['bus', 'by', 'work', 'to', 'go', 'I'],
    answer: [4, 2, 5, 1, 0, 3],
  },
};
const findError = {
  type: ExerciseType.FindError,
  payload: {
    prompt: 'She go to school.',
    incorrectForm: 'go',
    correction: 'goes',
  },
};

describe('parseUsagePointExerciseSeedFile', () => {
  it('accepts one array per egpIndex key, one of each exercise type', () => {
    const parsed = parseUsagePointExerciseSeedFile({
      '2': [fillBlank, multipleChoice, reorder, findError],
    });

    expect(parsed['2']).toHaveLength(4);
  });

  it('rejects a non-numeric egpIndex key', () => {
    expect(() =>
      parseUsagePointExerciseSeedFile({ abc: [fillBlank] }),
    ).toThrow();
  });

  it('rejects an empty exercise array for a key', () => {
    expect(() => parseUsagePointExerciseSeedFile({ '2': [] })).toThrow();
  });

  it.each([
    ['no blank', 'I go to work.'],
    ['a three-underscore blank', 'I ___ to work.'],
    ['two blanks', 'I ____ to ____.'],
  ])('rejects a fill_blank prompt with %s', (_, prompt) => {
    expect(() =>
      parseUsagePointExerciseSeedFile({
        '2': [{ ...fillBlank, payload: { ...fillBlank.payload, prompt } }],
      }),
    ).toThrow(BLANK_RE);
  });

  it('rejects a multiple_choice prompt without the blank', () => {
    expect(() =>
      parseUsagePointExerciseSeedFile({
        '2': [
          {
            ...multipleChoice,
            payload: { ...multipleChoice.payload, prompt: 'She plays.' },
          },
        ],
      }),
    ).toThrow(BLANK_RE);
  });

  it('rejects multiple_choice with an out-of-range answerIndex', () => {
    expect(() =>
      parseUsagePointExerciseSeedFile({
        '2': [
          {
            type: ExerciseType.MultipleChoice,
            payload: { prompt: 'x ____', options: ['a', 'b'], answerIndex: 2 },
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects reorder when answer length does not match scrambled length', () => {
    expect(() =>
      parseUsagePointExerciseSeedFile({
        '2': [
          {
            type: ExerciseType.Reorder,
            payload: { scrambled: ['a', 'b'], answer: [0] },
          },
        ],
      }),
    ).toThrow();
  });

  it('rejects grammar_contrastive — that type stays post-bespoke, not seeded here', () => {
    expect(() =>
      parseUsagePointExerciseSeedFile({
        '2': [{ type: ExerciseType.GrammarContrastive, payload: {} }],
      }),
    ).toThrow();
  });
});

describe('assets/grammar-usage-point-exercises.json', () => {
  it('parses and has exercises for exactly the EGP records that become usage points', async () => {
    const exercises = parseUsagePointExerciseSeedFile(
      JSON.parse(
        await readFile(
          join(process.cwd(), 'assets', 'grammar-usage-point-exercises.json'),
          'utf8',
        ),
      ),
    );
    const useIndexes = usagePointRecords(
      parseEgpRecords(
        JSON.parse(
          await readFile(join(process.cwd(), 'assets', 'egp.json'), 'utf8'),
        ),
      ),
    )
      .map((record) => String(record.index))
      .sort();

    expect(Object.keys(exercises).sort()).toEqual(useIndexes);
  });
});
