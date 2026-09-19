import { mergeAdjacentText, textPiece } from './apply-grammar-constructs.js';
import type { Block, Node, Paragraph } from './node-tree.types.js';

function stripNodes(nodes: Node[]): Node[] {
  return mergeAdjacentText(
    nodes.map((node) =>
      node.type === 'span' ? textPiece(node.text, node.marks) : node,
    ),
  );
}

// Collapses every word / phrase / grammar_only span back into a plain text
// node (marks kept, adjacent text merged), restoring the pre-annotation
// block. Used by `/retry`: the annotate splice must start from bare text,
// since a second pass over an already-spanned block would land several
// inserts in one existing span.
export function stripSpans(block: Block): Block {
  if (block.type === 'list') {
    return {
      ...block,
      items: block.items.map((item) => ({
        children: stripNodes(item.children),
      })),
    };
  }

  const paragraph: Paragraph = {
    type: 'paragraph',
    children: stripNodes(block.children),
  };
  if (block.level !== undefined) {
    paragraph.level = block.level;
  }
  if (block.quote !== undefined) {
    paragraph.quote = block.quote;
  }
  return paragraph;
}
