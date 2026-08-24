import { dedupeAnnotations } from './dedupe-annotations.js';
import type { Annotation } from './validate-annotations.js';

describe('dedupeAnnotations', () => {
  it('drops a later annotation that resolves to the same span as an earlier one', () => {
    const annotations: Annotation[] = [
      {
        start: 126,
        end: 135,
        form: 'relocated',
        kind: 'word',
        lemma: 'relocate',
        pos: 'verb',
        cefrLevel: 'B2',
      },
      {
        start: 126,
        end: 135,
        form: 'relocated',
        kind: 'word',
        lemma: 'relocate',
        pos: 'verb',
        cefrLevel: 'B2',
      },
    ];

    const result = dedupeAnnotations(annotations);

    expect(result).toHaveLength(1);
  });

  it('leaves distinct spans untouched', () => {
    const annotations: Annotation[] = [
      {
        start: 0,
        end: 6,
        form: 'Always',
        kind: 'word',
        lemma: 'always',
        pos: 'adverb',
        cefrLevel: 'A2',
      },
      {
        start: 7,
        end: 13,
        form: 'review',
        kind: 'word',
        lemma: 'review',
        pos: 'verb',
        cefrLevel: 'B1',
      },
    ];

    const result = dedupeAnnotations(annotations);

    expect(result).toHaveLength(2);
  });
});
