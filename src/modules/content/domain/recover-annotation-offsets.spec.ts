import { recoverAnnotationOffsets } from './recover-annotation-offsets.js';
import type { Annotation } from './validate-annotations.js';

describe('recoverAnnotationOffsets', () => {
  it('leaves an already-correct offset unchanged', () => {
    const text = 'Always review the fine print before signing any contract.';
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

    const [recovered] = recoverAnnotationOffsets(text, annotations);

    expect(recovered).toMatchObject({ start: 0, end: 6 });
  });

  it('recomputes a drifted offset from the model-reported form', () => {
    const text = 'Always review the fine print before signing any contract.';
    // Model claimed [18, 23) — the actual span for "fine", not "print".
    const annotations: Annotation[] = [
      {
        start: 18,
        end: 23,
        form: 'print',
        kind: 'word',
        lemma: 'print',
        pos: 'noun',
        cefrLevel: 'B2',
      },
    ];

    const [recovered] = recoverAnnotationOffsets(text, annotations);

    expect(recovered).toMatchObject({ start: 23, end: 28 });
    expect(text.slice(recovered.start, recovered.end)).toBe('print');
  });

  it('disambiguates a repeated form by picking the occurrence nearest the claimed start', () => {
    const text = 'The time to plan is now, not some other time.';
    const secondTimeIndex = text.lastIndexOf('time');
    const annotations: Annotation[] = [
      {
        // Claimed start is off by a couple characters but much closer to
        // the second occurrence than the first.
        start: secondTimeIndex - 2,
        end: secondTimeIndex - 2 + 4,
        form: 'time',
        kind: 'word',
        lemma: 'time',
        pos: 'noun',
        cefrLevel: 'A1',
      },
    ];

    const [recovered] = recoverAnnotationOffsets(text, annotations);

    expect(recovered.start).toBe(secondTimeIndex);
  });

  it('leaves an annotation unchanged when form is not found in text at all', () => {
    const text = 'Always review the fine print before signing any contract.';
    const annotations: Annotation[] = [
      {
        start: 0,
        end: 6,
        form: 'nonexistent',
        kind: 'word',
        lemma: 'nonexistent',
        pos: 'adjective',
        cefrLevel: 'B1',
      },
    ];

    const [recovered] = recoverAnnotationOffsets(text, annotations);

    expect(recovered).toMatchObject({ start: 0, end: 6, form: 'nonexistent' });
  });
});
