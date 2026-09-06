import {
  buildComprehensionUserText,
  comprehensionToolSchema,
} from './comprehension-prompt.js';

function question(overrides: Record<string, unknown> = {}) {
  return {
    question: 'What happened first?',
    options: ['A', 'B', 'C', 'D'],
    answerIndex: 1,
    ...overrides,
  };
}

describe('buildComprehensionUserText', () => {
  it('numbers sentences from zero, one per line', () => {
    expect(buildComprehensionUserText(['First.', 'Second.'])).toBe(
      '[0] First.\n[1] Second.',
    );
  });
});

describe('comprehensionToolSchema', () => {
  it('accepts two-to-five questions with four options each', () => {
    const parsed = comprehensionToolSchema.parse({
      questions: [question(), question({ answerIndex: 3 })],
    });
    expect(parsed.questions).toHaveLength(2);
  });

  it('rejects a question with the wrong number of options', () => {
    expect(() =>
      comprehensionToolSchema.parse({
        questions: [question(), question({ options: ['A', 'B', 'C'] })],
      }),
    ).toThrow();
  });

  it('rejects an answerIndex outside 0..3', () => {
    expect(() =>
      comprehensionToolSchema.parse({
        questions: [question(), question({ answerIndex: 4 })],
      }),
    ).toThrow();
  });

  it('rejects fewer than two questions', () => {
    expect(() =>
      comprehensionToolSchema.parse({ questions: [question()] }),
    ).toThrow();
  });
});
