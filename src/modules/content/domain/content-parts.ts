import { ContentPartKind } from '../enums/content-part-kind.enum.js';
import type { Block, Doc } from './node-tree.types.js';

export interface ContentPartSpec {
  blockIndex: number;
  kind: ContentPartKind;
  body: Block;
}

function kindOf(block: Block): ContentPartKind {
  return block.type === 'paragraph'
    ? ContentPartKind.Paragraph
    : ContentPartKind.List;
}

// Splits a Doc into one spec per top-level block, in Doc.children order.
export function splitDocIntoParts(doc: Doc): ContentPartSpec[] {
  return doc.children.map((block, blockIndex) => ({
    blockIndex,
    kind: kindOf(block),
    body: block,
  }));
}

// Inverse of splitDocIntoParts — reassembles a Doc from parts in any order.
export function assembleDocFromParts(
  parts: readonly Pick<ContentPartSpec, 'blockIndex' | 'body'>[],
): Doc {
  const children = [...parts]
    .sort((a, b) => a.blockIndex - b.blockIndex)
    .map((part) => part.body);

  return { type: 'doc', children };
}
