import { parseAnnotationTags } from './parse-annotation-tags.js';

describe('parseAnnotationTags', () => {
  it('extracts a single word annotation and marks the text complete', () => {
    const text = 'The cat sat.';
    const raw = 'The cat{{w|noun|cat}} sat.';

    const result = parseAnnotationTags(text, raw);

    expect(result.isComplete).toBe(true);
    expect(result.annotations).toEqual([
      {
        start: 4,
        end: 7,
        form: 'cat',
        kind: 'word',
        pos: 'noun',
        lemma: 'cat',
      },
    ]);
  });

  it('groups a non-adjacent phrasal verb under one phraseGroupId', () => {
    const text = 'She took her coat off.';
    const raw =
      'She ⟦took⟧{{p|phrasal_verb|take off|g1}} her coat ⟦off⟧{{p|phrasal_verb|take off|g1}}.';

    const result = parseAnnotationTags(text, raw);

    expect(result.isComplete).toBe(true);
    expect(result.annotations).toEqual([
      {
        start: 4,
        end: 8,
        form: 'took',
        kind: 'phrase',
        phraseType: 'phrasal_verb',
        phraseText: 'take off',
        phraseGroupId: 'g1',
      },
      {
        start: 18,
        end: 21,
        form: 'off',
        kind: 'phrase',
        phraseType: 'phrasal_verb',
        phraseText: 'take off',
        phraseGroupId: 'g1',
      },
    ]);
  });

  it('tolerates single braces the model occasionally emits instead of double', () => {
    const text = 'Run fast.';
    const raw = 'Run{w|verb|run} fast.';

    const result = parseAnnotationTags(text, raw);

    expect(result.isComplete).toBe(true);
    expect(result.annotations).toEqual([
      {
        start: 0,
        end: 3,
        form: 'Run',
        kind: 'word',
        pos: 'verb',
        lemma: 'run',
      },
    ]);
  });

  it('accepts a lemma containing a colon, e.g. a time value', () => {
    // Pipe-delimited fields exist specifically so this doesn't break — a
    // colon-delimited format would misparse the lemma at its first colon.
    const text = 'It happened at 11:47 p.m.';
    const raw = 'It happened at 11:47{{w|numeral|11:47}} p.m.';

    const result = parseAnnotationTags(text, raw);

    expect(result.isComplete).toBe(true);
    expect(result.annotations).toEqual([
      {
        start: 15,
        end: 20,
        form: '11:47',
        kind: 'word',
        pos: 'numeral',
        lemma: '11:47',
      },
    ]);
  });

  it('strips a leading "(" that the token class would otherwise absorb into the word', () => {
    // regex .exec() finds the leftmost matching position — "(" satisfies
    // [^\s{}]+ just as well as a letter does, so without stripping it, "("
    // ends up inside form/lemma even though the model correctly left it
    // untagged (it only tagged "i.e.").
    const text = 'three times (i.e., not once)';
    const raw = 'three times (i.e.{{w|other|i.e.}}, not once)';

    const result = parseAnnotationTags(text, raw);

    expect(result.isComplete).toBe(true);
    expect(result.annotations).toEqual([
      {
        start: 13,
        end: 17,
        form: 'i.e.',
        kind: 'word',
        pos: 'other',
        lemma: 'i.e.',
      },
    ]);
  });

  it('marks the text incomplete when a tagged word cannot be found in the original', () => {
    const text = 'The dog ran.';
    const raw = 'The puppy{{w|noun|puppy}} ran.';

    const result = parseAnnotationTags(text, raw);

    expect(result.isComplete).toBe(false);
  });

  it('marks the text incomplete when a tag is malformed and left unparsed', () => {
    const text = 'A cron job runs.';
    const raw = 'A{{}} cron{{w|noun|cron}} job{{w|noun|job}} runs.';

    const result = parseAnnotationTags(text, raw);

    expect(result.isComplete).toBe(false);
    // The two well-formed tags still resolve — one malformed tag doesn't
    // take down the annotations the response otherwise got right.
    expect(result.annotations).toHaveLength(2);
  });

  it('marks the text incomplete when the model stops before the end of the text', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    const raw =
      'The quick{{w|adjective|quick}} brown{{w|adjective|brown}} fox{{w|noun|fox}}';

    const result = parseAnnotationTags(text, raw);

    expect(result.isComplete).toBe(false);
    expect(result.annotations).toHaveLength(3);
  });
});
