import type { Annotation } from './validate-annotations.js';

// Models occasionally emit two separate tool-call entries for the same
// occurrence of a word (sometimes with stray hallucinated fields on one
// copy, e.g. an extra "start2" key) — after recoverAnnotationOffsets both
// resolve to the identical span, which then trips checkNoOverlaps. Collapse
// exact-span duplicates here, keeping the first (the model's own generation
// order — later copies add nothing validateAnnotations doesn't already
// have from the first).
export function dedupeAnnotations(annotations: Annotation[]): Annotation[] {
  const seen = new Set<string>();

  return annotations.filter((annotation) => {
    const key = `${annotation.start}:${annotation.end}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
