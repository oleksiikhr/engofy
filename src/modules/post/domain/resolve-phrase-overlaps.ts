import { spansOverlap } from './span-range.js';
import type { Annotation } from './validate-annotations.js';

// A deterministic phrase — a spaCy phrasal-verb group, carrying a
// pre-resolved `phraseId` — beats an AI idiom/collocation that straddles it.
// Drops an AI phrase group in full as soon as any one of its fragments
// overlaps a deterministic fragment: validateAnnotations' checkNoOverlaps is
// all-or-nothing, so a half-dropped group would still crash the job. This is
// the phrase↔phrase counterpart to resolveWordPhraseOverlaps (phrase beats
// word).
export function resolvePhraseOverlaps(annotations: Annotation[]): Annotation[] {
  const deterministic = annotations.filter(
    (a) => a.kind === 'phrase' && a.phraseId !== undefined,
  );
  if (deterministic.length === 0) {
    return annotations;
  }

  const droppedGroups = new Set<string>();
  for (const annotation of annotations) {
    if (
      annotation.kind !== 'phrase' ||
      annotation.phraseId !== undefined ||
      annotation.phraseGroupId === undefined
    ) {
      continue;
    }
    if (deterministic.some((d) => spansOverlap(annotation, d))) {
      droppedGroups.add(annotation.phraseGroupId);
    }
  }

  if (droppedGroups.size === 0) {
    return annotations;
  }

  return annotations.filter(
    (a) =>
      !(
        a.kind === 'phrase' &&
        a.phraseId === undefined &&
        a.phraseGroupId !== undefined &&
        droppedGroups.has(a.phraseGroupId)
      ),
  );
}
