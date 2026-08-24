import { dropIncompleteAnnotations } from './drop-incomplete-annotations.js';
import type { Annotation } from './validate-annotations.js';

describe('dropIncompleteAnnotations', () => {
  it('drops a word annotation missing cefrLevel', () => {
    const annotations: Annotation[] = [
      {
        start: 0,
        end: 6,
        form: 'Always',
        kind: 'word',
        lemma: 'always',
        pos: 'adverb',
      },
    ];

    expect(dropIncompleteAnnotations(annotations)).toHaveLength(0);
  });

  it('drops a word annotation missing lemma or pos', () => {
    const annotations: Annotation[] = [
      { start: 0, end: 6, form: 'Always', kind: 'word', cefrLevel: 'A2' },
    ];

    expect(dropIncompleteAnnotations(annotations)).toHaveLength(0);
  });

  it('drops a phrase annotation missing phraseText or phraseGroupId', () => {
    const annotations: Annotation[] = [
      { start: 0, end: 8, form: 'fine print', kind: 'phrase' },
    ];

    expect(dropIncompleteAnnotations(annotations)).toHaveLength(0);
  });

  it('keeps a complete word annotation', () => {
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
    ];

    expect(dropIncompleteAnnotations(annotations)).toHaveLength(1);
  });

  it('keeps a complete phrase annotation', () => {
    const annotations: Annotation[] = [
      {
        start: 0,
        end: 8,
        form: 'fine print',
        kind: 'phrase',
        phraseText: 'fine print',
        phraseGroupId: 'g1',
      },
    ];

    expect(dropIncompleteAnnotations(annotations)).toHaveLength(1);
  });
});
