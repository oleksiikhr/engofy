import { parseGrammarTags } from './parse-grammar-tags.js';

describe('parseGrammarTags', () => {
  it('recovers a tagged span with its char offsets and usage-point index', () => {
    const text = 'She had never visited Tokyo before that trip.';
    const raw =
      'She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo before that trip.';

    const result = parseGrammarTags(text, raw);

    expect(result.isComplete).toBe(true);
    expect(result.spans).toEqual([
      {
        form: 'had never visited',
        charStart: 4,
        charEnd: 21,
        slug: 'past-perfect',
        egpIndex: 412,
      },
    ]);
  });

  it('accepts a construction-only tag (no usage-point index)', () => {
    const text = 'If it rains we stay.';
    const raw = '⟦If it rains⟧{{g|conditional-zero}} we stay.';

    const result = parseGrammarTags(text, raw);

    expect(result.isComplete).toBe(true);
    expect(result.spans[0]).toMatchObject({
      form: 'If it rains',
      slug: 'conditional-zero',
      egpIndex: null,
    });
  });

  it('handles multiple non-overlapping spans in reading order', () => {
    const text = 'I have finished and she will go.';
    const raw =
      'I ⟦have finished⟧{{g|present-perfect|10}} and she ⟦will go⟧{{g|future-will|20}}.';

    const result = parseGrammarTags(text, raw);

    expect(result.isComplete).toBe(true);
    expect(result.spans.map((s) => s.form)).toEqual([
      'have finished',
      'will go',
    ]);
    expect(result.spans.map((s) => s.charStart)).toEqual([2, 24]);
  });

  it('flags incompleteness when the stripped output does not reconstruct the text', () => {
    const text = 'She had never visited Tokyo before.';
    const raw = 'She ⟦had never visited⟧{{g|past-perfect|412}} Tokyo.'; // dropped "before."

    expect(parseGrammarTags(text, raw).isComplete).toBe(false);
  });

  it('flags incompleteness when a tagged fragment is not found in the text', () => {
    const text = 'She has arrived.';
    const raw = 'She ⟦had arrived⟧{{g|past-perfect|1}}.'; // "had" not in text

    const result = parseGrammarTags(text, raw);
    expect(result.isComplete).toBe(false);
  });

  it('tolerates single braces', () => {
    const text = 'We will go.';
    const raw = '⟦We will go⟧{g|future-will|5}.';

    expect(parseGrammarTags(text, raw).spans[0]).toMatchObject({
      slug: 'future-will',
      egpIndex: 5,
    });
  });

  it('recovers both spans when the model nests one tag inside another', () => {
    const text = 'Stay calm even if the offer feels disappointingly low.';
    const raw =
      '⟦Stay calm⟧{{g|clauses-imperatives|187}} ⟦even if the offer feels ' +
      '⟦disappointingly⟧{{g|adverbs-adverbs-as-modifiers|107}} low⟧' +
      '{{g|clauses-subordinated|246}}.';

    const result = parseGrammarTags(text, raw);

    expect(result.isComplete).toBe(true);
    expect(result.spans).toEqual([
      {
        form: 'Stay calm',
        charStart: 0,
        charEnd: 9,
        slug: 'clauses-imperatives',
        egpIndex: 187,
      },
      {
        form: 'disappointingly',
        charStart: 34,
        charEnd: 49,
        slug: 'adverbs-adverbs-as-modifiers',
        egpIndex: 107,
      },
      {
        form: 'even if the offer feels disappointingly low',
        charStart: 10,
        charEnd: 53,
        slug: 'clauses-subordinated',
        egpIndex: 246,
      },
    ]);
  });

  it('flags incompleteness when a ⟦ is never closed', () => {
    const text = 'She left early.';
    const raw = 'She ⟦left early.';

    expect(parseGrammarTags(text, raw).isComplete).toBe(false);
  });

  it('flags incompleteness on a bare ⟧ with no tag trailer', () => {
    const text = 'She left early.';
    const raw = 'She left⟧ early.';

    const result = parseGrammarTags(text, raw);
    expect(result.isComplete).toBe(false);
    expect(result.spans).toEqual([]);
  });
});
