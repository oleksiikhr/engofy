import type { Block, Node, SpanNode } from './node-tree.types.js';

// Every `span` leaf node inside the given blocks, in document order. Used by
// the reader page (resolve span → lexicon entry) and the dictionary
// (word/phrase → the posts that use it).
export function collectSpanNodes(blocks: Block[]): SpanNode[] {
  const spans: SpanNode[] = [];
  const visit = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.type === 'span') {
        spans.push(node);
      }
    }
  };
  for (const block of blocks) {
    if (block.type === 'paragraph') {
      visit(block.children);
    } else {
      for (const item of block.items) {
        visit(item.children);
      }
    }
  }
  return spans;
}
