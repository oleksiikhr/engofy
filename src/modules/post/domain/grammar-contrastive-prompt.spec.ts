import { z } from 'zod';
import {
  buildGrammarContrastiveUserText,
  grammarContrastiveToolSchema,
  markSentenceSpan,
} from './grammar-contrastive-prompt.js';

function result(overrides: Record<string, unknown> = {}) {
  return {
    explanation: 'Present perfect links the past to now, unlike past simple.',
    question: 'She ____ here since 2010.',
    options: ['has lived', 'lived', 'was living'],
    answerIndex: 0,
    optionExplanations: [
      'Fits "since".',
      'Ends in the past.',
      'Not for states.',
    ],
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
  it('accepts three or four options with one explanation each', () => {
    expect(grammarContrastiveToolSchema.parse(result()).options).toHaveLength(
      3,
    );
  });

  it('rejects fewer than three options', () => {
    expect(() =>
      grammarContrastiveToolSchema.parse(
        result({ options: ['a', 'b'], optionExplanations: ['x', 'y'] }),
      ),
    ).toThrow();
  });

  it('rejects an answerIndex outside the options', () => {
    expect(() =>
      grammarContrastiveToolSchema.parse(result({ answerIndex: 3 })),
    ).toThrow();
  });

  it('rejects a mismatched optionExplanations length', () => {
    expect(() =>
      grammarContrastiveToolSchema.parse(
        result({ optionExplanations: ['only one'] }),
      ),
    ).toThrow();
  });

  it('unwraps array fields the model sent as JSON-encoded strings', () => {
    const parsed = grammarContrastiveToolSchema.parse(
      result({
        options: JSON.stringify(['has lived', 'lived', 'was living']),
        optionExplanations: JSON.stringify(['a', 'b', 'c']),
      }),
    );
    expect(parsed.options).toEqual(['has lived', 'lived', 'was living']);
    expect(parsed.optionExplanations).toEqual(['a', 'b', 'c']);
  });

  it('still rejects a string that is not a JSON array', () => {
    expect(() =>
      grammarContrastiveToolSchema.parse(
        result({ options: 'has lived, lived, was living' }),
      ),
    ).toThrow();
  });

  it('advertises the array fields as arrays in the JSON schema', () => {
    const json = z.toJSONSchema(grammarContrastiveToolSchema) as {
      properties: Record<string, { type?: string }>;
    };
    expect(json.properties.options?.type).toBe('array');
    expect(json.properties.optionExplanations?.type).toBe('array');
  });
});
