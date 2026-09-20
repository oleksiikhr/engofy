import { z } from 'zod';
import {
  buildGrammarContrastiveUserText,
  grammarContrastiveToolSchema,
  markSentenceSpan,
  toGrammarContrastivePayload,
} from './grammar-contrastive-prompt.js';

function result(overrides: Record<string, unknown> = {}) {
  return {
    explanation: 'Present perfect links the past to now, unlike past simple.',
    question: 'She ____ here since 2010.',
    correctOption: 'has lived',
    correctExplanation: 'Fits "since".',
    wrongOption1: 'lived',
    wrongExplanation1: 'Ends in the past.',
    wrongOption2: 'was living',
    wrongExplanation2: 'Not for states.',
    ...overrides,
  };
}

describe('markSentenceSpan', () => {
  it('wraps the char range in ⟦…⟧', () => {
    expect(markSentenceSpan('She has lived here.', 4, 13)).toBe(
      'She ⟦has lived⟧ here.',
    );
  });
});

describe('buildGrammarContrastiveUserText', () => {
  it('lists the sentence, usage point and capped sibling guidewords', () => {
    const text = buildGrammarContrastiveUserText({
      markedSentence: 'She ⟦has lived⟧ here.',
      constructionName: 'Present perfect',
      guideword: 'USE: UNFINISHED TIME',
      canDoStatement: 'Can use it for states continuing to now.',
      siblings: [
        { name: 'Past simple', guidewords: ['a', 'b', 'c', 'd'] },
        { name: 'Present simple', guidewords: [] },
      ],
    });
    expect(text).toBe(
      [
        'Sentence: She ⟦has lived⟧ here.',
        'Construction: Present perfect',
        'Usage point: USE: UNFINISHED TIME — Can use it for states continuing to now.',
        'Competing constructions:\n- Past simple (a; b; c)\n- Present simple',
      ].join('\n'),
    );
  });
});

describe('grammarContrastiveToolSchema', () => {
  it('accepts two wrong options', () => {
    expect(grammarContrastiveToolSchema.parse(result()).wrongOption3).toBe(
      undefined,
    );
  });

  it('accepts a third wrong option with its explanation', () => {
    expect(
      grammarContrastiveToolSchema.parse(
        result({ wrongOption3: 'lives', wrongExplanation3: 'Not for since.' }),
      ).wrongOption3,
    ).toBe('lives');
  });

  it('rejects a third wrong option without its explanation', () => {
    expect(() =>
      grammarContrastiveToolSchema.parse(result({ wrongOption3: 'lives' })),
    ).toThrow();
  });

  it('rejects a missing required option field', () => {
    expect(() =>
      grammarContrastiveToolSchema.parse(result({ wrongOption2: undefined })),
    ).toThrow();
  });

  it('rejects an empty option', () => {
    expect(() =>
      grammarContrastiveToolSchema.parse(result({ correctOption: '' })),
    ).toThrow();
  });

  it('advertises only scalar fields in the JSON schema', () => {
    const json = z.toJSONSchema(grammarContrastiveToolSchema) as {
      properties: Record<string, { type?: string }>;
      required: string[];
    };
    expect(
      Object.values(json.properties).every((field) => field.type === 'string'),
    ).toBe(true);
    expect(json.required).not.toContain('wrongOption3');
    expect(json.required).toContain('wrongOption2');
  });
});

describe('toGrammarContrastivePayload', () => {
  it('builds the stored parallel-array shape with the correct option at answerIndex', () => {
    const payload = toGrammarContrastivePayload(
      grammarContrastiveToolSchema.parse(result()),
    );
    expect(payload.options).toHaveLength(3);
    expect([...payload.options].sort()).toEqual(
      ['has lived', 'lived', 'was living'].sort(),
    );
    expect(payload.options[payload.answerIndex]).toBe('has lived');
    expect(payload.optionExplanations[payload.answerIndex]).toBe(
      'Fits "since".',
    );
    const wrongIndex = payload.options.indexOf('lived');
    expect(payload.optionExplanations[wrongIndex]).toBe('Ends in the past.');
  });

  it('includes the optional fourth option', () => {
    const payload = toGrammarContrastivePayload(
      grammarContrastiveToolSchema.parse(
        result({ wrongOption3: 'lives', wrongExplanation3: 'Not for since.' }),
      ),
    );
    expect(payload.options).toHaveLength(4);
    expect(payload.optionExplanations).toHaveLength(4);
    expect(payload.options[payload.answerIndex]).toBe('has lived');
  });

  it('is deterministic for the same question and varies across questions', () => {
    const at = (question: string) =>
      toGrammarContrastivePayload(
        grammarContrastiveToolSchema.parse(result({ question })),
      ).answerIndex;
    expect(at('She ____ here.')).toBe(at('She ____ here.'));
    const positions = new Set(
      Array.from({ length: 30 }, (_, i) => at(`Question ${i} ____.`)),
    );
    expect(positions.size).toBeGreaterThan(1);
  });
});
