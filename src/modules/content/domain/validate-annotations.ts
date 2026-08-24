import { PartOfSpeech } from '../enums/part-of-speech.enum.js';
import { InvalidAnnotationOffsetError } from '../errors/invalid-annotation-offset.error.js';
import { InvalidAnnotationShapeError } from '../errors/invalid-annotation-shape.error.js';
import { OverlappingAnnotationsError } from '../errors/overlapping-annotations.error.js';

export interface Annotation {
  start: number;
  end: number;
  form: string;
  kind: 'word' | 'phrase';
  lemma?: string;
  pos?: string;
  phraseText?: string;
}

const PARTS_OF_SPEECH: readonly string[] = Object.values(PartOfSpeech);

function validateOffsets(text: string, annotation: Annotation): void {
  const { start, end, form } = annotation;

  if (!(start >= 0 && start < end && end <= text.length)) {
    throw new InvalidAnnotationOffsetError(
      `[${start}, ${end}) out of bounds for text of length ${text.length}`,
    );
  }

  if (text.slice(start, end) !== form) {
    throw new InvalidAnnotationOffsetError(
      `text[${start}:${end}] does not match form "${form}"`,
    );
  }
}

function validateShape(annotation: Annotation): void {
  if (annotation.kind === 'word') {
    if (
      !annotation.lemma ||
      !annotation.pos ||
      !PARTS_OF_SPEECH.includes(annotation.pos)
    ) {
      throw new InvalidAnnotationShapeError(
        'word annotation requires a non-empty lemma and a valid pos',
      );
    }
    return;
  }

  if (!annotation.phraseText) {
    throw new InvalidAnnotationShapeError(
      'phrase annotation requires a non-empty phraseText',
    );
  }
}

function checkNoOverlaps(annotations: Annotation[]): void {
  const sorted = [...annotations].sort((a, b) => a.start - b.start);

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];

    if (previous && current && current.start < previous.end) {
      throw new OverlappingAnnotationsError(current.start, current.end);
    }
  }
}

// All-or-nothing: throws on the first invalid annotation found, so callers must not
// write any of the batch's results unless this returns without throwing.
export function validateAnnotations(
  text: string,
  annotations: Annotation[],
): void {
  for (const annotation of annotations) {
    validateOffsets(text, annotation);
    validateShape(annotation);
  }

  checkNoOverlaps(annotations);
}
