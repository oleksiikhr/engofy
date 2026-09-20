import {
  buildGrammarEnrichmentUserText,
  grammarEnrichmentToolSchema,
  toGrammarEnrichmentContent,
} from './grammar-enrichment-prompt.js';

describe('buildGrammarEnrichmentUserText', () => {
  const input = {
    constructionName: 'present perfect simple',
    categoryName: 'PRESENT',
    cefrLevel: 'A2',
    guideword: 'USE: EXPERIENCE',
    canDoStatement: 'Can talk about life experiences.',
    cheatSheetContent: '## Form\nhave/has + past participle',
  };

  it('lists construction, level, usage point, can-do and form notes', () => {
    expect(buildGrammarEnrichmentUserText(input)).toBe(
      [
        'Construction: present perfect simple (PRESENT)',
        'Level: A2',
        'Usage point: USE: EXPERIENCE',
        'Can-do statement: Can talk about life experiences.',
        'Form notes:\n## Form\nhave/has + past participle',
      ].join('\n'),
    );
  });

  it('omits form notes when the construction has no cheat sheet', () => {
    expect(
      buildGrammarEnrichmentUserText({ ...input, cheatSheetContent: null }),
    ).not.toContain('Form notes');
  });

  it('truncates a long cheat sheet', () => {
    const text = buildGrammarEnrichmentUserText({
      ...input,
      cheatSheetContent: 'x'.repeat(5000),
    });

    expect(text.length).toBeLessThan(1800);
  });
});

describe('toGrammarEnrichmentContent', () => {
  it('collects the flat example fields in order', () => {
    expect(
      toGrammarEnrichmentContent({
        explanation: ' We use it for routines. ',
        explanationUk: ' Ми вживаємо це для рутини. ',
        example1: 'I get up at seven.',
        example2: 'She works here.',
        example3: 'They eat lunch at noon.',
      }),
    ).toEqual({
      explanation: 'We use it for routines.',
      explanationUk: 'Ми вживаємо це для рутини.',
      examples: [
        'I get up at seven.',
        'She works here.',
        'They eat lunch at noon.',
      ],
    });
  });

  it('leaves the optional third example out', () => {
    expect(
      toGrammarEnrichmentContent({
        explanation: 'Explanation.',
        explanationUk: 'Пояснення.',
        example1: 'One.',
        example2: 'Two.',
      }).examples,
    ).toEqual(['One.', 'Two.']);
  });
});

describe('grammarEnrichmentToolSchema', () => {
  it('rejects an empty explanation', () => {
    expect(
      grammarEnrichmentToolSchema.safeParse({
        explanation: '',
        explanationUk: 'Пояснення.',
        example1: 'One.',
        example2: 'Two.',
      }).success,
    ).toBe(false);
  });

  it('rejects a missing Ukrainian explanation', () => {
    expect(
      grammarEnrichmentToolSchema.safeParse({
        explanation: 'Explanation.',
        example1: 'One.',
        example2: 'Two.',
      }).success,
    ).toBe(false);
  });
});
