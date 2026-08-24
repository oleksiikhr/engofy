import type { Annotation } from './validate-annotations.js';

function spansOverlap(a: Annotation, b: Annotation): boolean {
  return a.start < b.end && b.start < a.end;
}

// The system prompt tells the model not to also tag a word standalone when
// it's covered by a phrase fragment ("pick one"), but that instruction
// isn't reliably followed — the model sometimes emits both. Enforce it in
// code instead of trusting prose: a phrase annotation always wins over an
// overlapping word annotation.
export function resolveWordPhraseOverlaps(
  annotations: Annotation[],
): Annotation[] {
  const phrases = annotations.filter((a) => a.kind === 'phrase');

  return annotations.filter(
    (annotation) =>
      annotation.kind === 'phrase' ||
      !phrases.some((phrase) => spansOverlap(annotation, phrase)),
  );
}
