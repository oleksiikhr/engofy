import type { NodeOffset } from './flatten.js';
import { contains } from './span-range.js';
import type { Annotation } from './validate-annotations.js';

// The model only ever sees flattened plain text — it has no visibility into
// where a bold/italic/link boundary falls in the original node tree, so a
// tagged span can straddle one (e.g. "at least two months" crossing out of
// a bold "at least" run into the following plain text). splice-spans.ts
// requires every insert to fall within exactly one existing child node and
// throws (all-or-nothing) otherwise, so drop any such annotation here
// instead of letting one bad span crash the whole block.
//
// A span that falls *inside* a `link` node is also dropped: splicing it would
// split the link into "lead <a>" + span + "trail <a>" fragments and leave the
// annotated words outside the anchor (a citation link renders broken). A link
// is kept atomic; per-word tooltips on the two or three words inside it are
// not worth that.
export function dropSpansCrossingNodeBoundaries(
  offsets: NodeOffset[],
  annotations: Annotation[],
): Annotation[] {
  return annotations.filter((annotation) =>
    offsets.some(
      (offset) => offset.type !== 'link' && contains(offset, annotation),
    ),
  );
}
