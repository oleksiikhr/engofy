import type { Annotation } from './validate-annotations.js';

function findOccurrences(text: string, form: string): number[] {
  if (!form) {
    return [];
  }

  const indices: number[] = [];
  let fromIndex = 0;
  let index = text.indexOf(form, fromIndex);
  while (index !== -1) {
    indices.push(index);
    fromIndex = index + 1;
    index = text.indexOf(form, fromIndex);
  }

  return indices;
}

// Models reliably identify *which* substring an annotation refers to (the
// `form`) but drift on the exact character offset as the excerpt gets
// longer — token-based generation doesn't align with character counting, so
// a model-reported start/end accumulates error over a sentence. Treat
// `form` as ground truth and recompute start/end by locating it in `text`,
// picking the occurrence nearest the model's claimed `start` to disambiguate
// a form that appears more than once. A `form` not found in `text` at all is
// left untouched — validateAnnotations rejects it with a clear error rather
// than this function silently guessing.
export function recoverAnnotationOffsets(
  text: string,
  annotations: Annotation[],
): Annotation[] {
  return annotations.map((annotation) => {
    const occurrences = findOccurrences(text, annotation.form);
    if (occurrences.length === 0) {
      return annotation;
    }

    const nearestStart = occurrences.reduce((best, candidate) =>
      Math.abs(candidate - annotation.start) < Math.abs(best - annotation.start)
        ? candidate
        : best,
    );

    return {
      ...annotation,
      start: nearestStart,
      end: nearestStart + annotation.form.length,
    };
  });
}
