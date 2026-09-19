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
});
