import { convertMarkdownToDoc } from '../../src/modules/post/converters/markdown-to-doc.converter.js';
import type { NodeOffset } from '../../src/modules/post/domain/flatten.js';
import { flattenDoc } from '../../src/modules/post/domain/flatten.js';
import { splitIntoSentences } from './split-sentences.js';

export interface Unit {
  text: string;
  label: string;
  nodeOffsets?: NodeOffset[];
}

export type Granularity = 'block' | 'sentence';

// Shared by run.ts and snapshot.ts so both test against exactly the same
// units the annotate-post pipeline would see — real production parsing
// (marked via convertMarkdownToDoc + flattenDoc), not a hand-rolled
// approximation. See run.ts's original comment (moved here) for why this
// matters: it's what lets dropSpansCrossingNodeBoundaries run in this
// harness at all.
export function buildUnits(markdown: string, granularity: Granularity): Unit[] {
  const doc = convertMarkdownToDoc(markdown);
  const { text: fullText, units: flatUnits } = flattenDoc(doc);

  const blockUnits: Unit[] = flatUnits
    .map((u) => ({
      text: fullText.slice(u.start, u.end),
      label: `block${u.blockIndex}${u.itemIndex !== undefined ? `-item${u.itemIndex}` : ''}`,
      nodeOffsets: u.nodes,
    }))
    .filter((u) => u.text.trim());

  if (granularity !== 'sentence') {
    return blockUnits;
  }

  // Sentence mode discards nodeOffsets: they're indices into the whole
  // block's text, and re-basing them onto each sentence's own local offsets
  // isn't needed yet to test the granularity question itself.
  return blockUnits.flatMap((block) =>
    splitIntoSentences(block.text).map((text, i) => ({
      text,
      label: `${block.label}-s${i}`,
    })),
  );
}
