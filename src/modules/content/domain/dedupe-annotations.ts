import type { Annotation } from './validate-annotations.js';

// Two sources of exact-span duplicates: a single response occasionally
// tagging the same word/phrase fragment twice, and
// AnnotateContentHandler.computeAnnotations merging a retry attempt's
// annotations in alongside the first when parseAnnotationTags reports the
// first as incomplete — both attempts often (re-)find the same earlier
// spans. Collapse them here, keeping the first occurrence (later copies add
// nothing validateAnnotations doesn't already have).
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
