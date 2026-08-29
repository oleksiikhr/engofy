import { PostPartKind } from '../enums/post-part-kind.enum.js';
import type { Block, Doc } from './node-tree.types.js';

export interface PostPartSpec {
  blockIndex: number;
  kind: PostPartKind;
  body: Block;
}

function kindOf(block: Block): PostPartKind {
  return block.type === 'paragraph'
    ? PostPartKind.Paragraph
    : PostPartKind.List;
}

// Splits a Doc into one spec per top-level block, in Doc.children order.
export function splitDocIntoParts(doc: Doc): PostPartSpec[] {
  return doc.children.map((block, blockIndex) => ({
    blockIndex,
    kind: kindOf(block),
    body: block,
  }));
}

// Inverse of splitDocIntoParts — reassembles a Doc from parts in any order.
export function assembleDocFromParts(
  parts: readonly Pick<PostPartSpec, 'blockIndex' | 'body'>[],
): Doc {
  const children = [...parts]
    .sort((a, b) => a.blockIndex - b.blockIndex)
    .map((part) => part.body);

  return { type: 'doc', children };
}
