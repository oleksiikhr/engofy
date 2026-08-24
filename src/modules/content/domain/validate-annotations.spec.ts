import { InvalidAnnotationOffsetError } from '../errors/invalid-annotation-offset.error.js';
import { InvalidAnnotationShapeError } from '../errors/invalid-annotation-shape.error.js';
import { OverlappingAnnotationsError } from '../errors/overlapping-annotations.error.js';
import type { Annotation } from './validate-annotations.js';
import { validateAnnotations } from './validate-annotations.js';

const TEXT = 'The government announced negotiate today.';

describe('validateAnnotations', () => {
  it('accepts a batch of valid, non-overlapping word and phrase annotations', () => {
    const annotations: Annotation[] = [
      {
        start: 4,
        end: 14,
        form: 'government',
        kind: 'word',
        lemma: 'government',
        pos: 'noun',
        cefrLevel: 'B1',
      },
      {
        start: 25,
        end: 34,
        form: 'negotiate',
        kind: 'word',
        lemma: 'negotiate',
        pos: 'verb',
        cefrLevel: 'B2',
      },
    ];

    expect(() => validateAnnotations(TEXT, annotations)).not.toThrow();
  });

  it('accepts a multi-fragment phrase sharing one phraseGroupId', () => {
    const text = 'She took her coat off before dinner.';
    const annotations: Annotation[] = [
      {
        start: 4,
        end: 8,
        form: 'took',
        kind: 'phrase',
        phraseText: 'take off',
        phraseType: 'phrasal_verb',
        phraseGroupId: 'g1',
        cefrLevel: 'A2',
      },
      {
        start: 18,
        end: 21,
        form: 'off',
        kind: 'phrase',
        phraseText: 'take off',
        phraseType: 'phrasal_verb',
        phraseGroupId: 'g1',
        cefrLevel: 'A2',
      },
    ];

    expect(() => validateAnnotations(text, annotations)).not.toThrow();
  });

  it('rejects an out-of-bounds offset', () => {
    const annotations: Annotation[] = [
      {
        start: 0,
        end: TEXT.length + 1,
        form: TEXT,
        kind: 'word',
        lemma: 'x',
        pos: 'noun',
        cefrLevel: 'A1',
      },
    ];

    expect(() => validateAnnotations(TEXT, annotations)).toThrow(
      InvalidAnnotationOffsetError,
    );
  });

  it('rejects an offset whose text slice does not match the given form', () => {
    const annotations: Annotation[] = [
      {
        start: 4,
        end: 14,
        form: 'wrong-form',
        kind: 'word',
        lemma: 'government',
        pos: 'noun',
        cefrLevel: 'B1',
      },
    ];

    expect(() => validateAnnotations(TEXT, annotations)).toThrow(
      InvalidAnnotationOffsetError,
    );
  });

  it('rejects a word annotation missing lemma or pos', () => {
    const annotations: Annotation[] = [
      { start: 4, end: 14, form: 'government', kind: 'word', cefrLevel: 'B1' },
    ];

    expect(() => validateAnnotations(TEXT, annotations)).toThrow(
      InvalidAnnotationShapeError,
    );
  });

  it('rejects a word annotation with an invalid pos', () => {
    const annotations: Annotation[] = [
      {
        start: 4,
        end: 14,
        form: 'government',
        kind: 'word',
        lemma: 'government',
        pos: 'bogus-pos',
        cefrLevel: 'B1',
      },
    ];

    expect(() => validateAnnotations(TEXT, annotations)).toThrow(
      InvalidAnnotationShapeError,
    );
  });

  it('rejects a word annotation missing cefrLevel', () => {
    const annotations: Annotation[] = [
      {
        start: 4,
        end: 14,
        form: 'government',
        kind: 'word',
        lemma: 'government',
        pos: 'noun',
      },
    ];

    expect(() => validateAnnotations(TEXT, annotations)).toThrow(
      InvalidAnnotationShapeError,
    );
  });

  it('rejects a word annotation with an invalid cefrLevel', () => {
    const annotations: Annotation[] = [
      {
        start: 4,
        end: 14,
        form: 'government',
        kind: 'word',
        lemma: 'government',
        pos: 'noun',
        cefrLevel: 'bogus-level',
      },
    ];

    expect(() => validateAnnotations(TEXT, annotations)).toThrow(
      InvalidAnnotationShapeError,
    );
  });

  it('rejects a phrase annotation missing phraseText', () => {
    const annotations: Annotation[] = [
      { start: 4, end: 14, form: 'government', kind: 'phrase' },
    ];

    expect(() => validateAnnotations(TEXT, annotations)).toThrow(
      InvalidAnnotationShapeError,
    );
  });

  it('rejects a phrase annotation missing phraseGroupId', () => {
    const annotations: Annotation[] = [
      {
        start: 4,
        end: 14,
        form: 'government',
        kind: 'phrase',
        phraseText: 'government announced',
      },
    ];

    expect(() => validateAnnotations(TEXT, annotations)).toThrow(
      InvalidAnnotationShapeError,
    );
  });

  it('rejects a phrase annotation with an invalid phraseType', () => {
    const annotations: Annotation[] = [
      {
        start: 4,
        end: 14,
        form: 'government',
        kind: 'phrase',
        phraseText: 'government announced',
        phraseGroupId: 'g1',
        phraseType: 'bogus-type',
      },
    ];

    expect(() => validateAnnotations(TEXT, annotations)).toThrow(
      InvalidAnnotationShapeError,
    );
  });

  it('rejects two overlapping annotations', () => {
    const annotations: Annotation[] = [
      {
        start: 4,
        end: 14,
        form: 'government',
        kind: 'word',
        lemma: 'government',
        pos: 'noun',
        cefrLevel: 'B1',
      },
      {
        start: 10,
        end: 20,
        form: TEXT.slice(10, 20),
        kind: 'word',
        lemma: 'x',
        pos: 'noun',
        cefrLevel: 'B1',
      },
    ];

    expect(() => validateAnnotations(TEXT, annotations)).toThrow(
      OverlappingAnnotationsError,
    );
  });

  it('rejects the whole batch when only one of several annotations is invalid (all-or-nothing)', () => {
    const annotations: Annotation[] = [
      {
        start: 4,
        end: 14,
        form: 'government',
        kind: 'word',
        lemma: 'government',
        pos: 'noun',
        cefrLevel: 'B1',
      },
      { start: 25, end: 34, form: 'negotiate', kind: 'word' },
    ];

    expect(() => validateAnnotations(TEXT, annotations)).toThrow(
      InvalidAnnotationShapeError,
    );
  });
});
