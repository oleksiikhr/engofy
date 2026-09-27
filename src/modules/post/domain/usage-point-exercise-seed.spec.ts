import { ExerciseType } from '../enums/exercise-type.enum.js';
import { parseUsagePointExerciseSeedFile } from './usage-point-exercise-seed.js';

const fillBlank = {
  type: ExerciseType.FillBlank,
  payload: {
    prompt: 'I ___ to work by bus.',
    answer: 'go',
    options: ['go', 'goes'],
  },
};
const multipleChoice = {
  type: ExerciseType.MultipleChoice,
  payload: {
    prompt: 'She ___ football.',
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

  it('rejects multiple_choice with an out-of-range answerIndex', () => {
    expect(() =>
      parseUsagePointExerciseSeedFile({
        '2': [
          {
            type: ExerciseType.MultipleChoice,
            payload: { prompt: 'x', options: ['a', 'b'], answerIndex: 2 },
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
