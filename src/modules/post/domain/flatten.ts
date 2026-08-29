import type {
  Block,
  Doc,
  ListBlock,
  Node,
  Paragraph,
} from './node-tree.types.js';

export interface NodeOffset {
  index: number;
  start: number;
  end: number;
}

export interface FlattenedUnit {
  // Index of this unit's block within Doc.children.
  blockIndex: number;
  // Index within ListBlock.items — present only for a unit that came from a
  // list item; absent for a unit that came from a Paragraph.
  itemIndex?: number;
  start: number;
  end: number;
  nodes: NodeOffset[];
}

const PARAGRAPH_SEPARATOR = '\n\n';

function nodeText(node: Node): string {
  return node.text;
}

export function flattenNodes(children: Node[]): {
  text: string;
  offsets: NodeOffset[];
} {
  let cursor = 0;
  let text = '';
  let index = 0;
  const offsets: NodeOffset[] = [];

  for (const node of children) {
    const childText = nodeText(node);
    offsets.push({ index, start: cursor, end: cursor + childText.length });
    text += childText;
    cursor += childText.length;
    index += 1;
  }

  return { text, offsets };
}

export function flattenParagraph(paragraph: Paragraph): {
  text: string;
  offsets: NodeOffset[];
} {
  return flattenNodes(paragraph.children);
}

function isParagraph(block: Block): block is Paragraph {
  return block.type === 'paragraph';
}

function isListBlock(block: Block): block is ListBlock {
  return block.type === 'list';
}

// Flattens every block into one whole-doc text, joined by a blank line.
// ListBlock items are flattened one unit per item (with `itemIndex` set), so
// list text reaches the AI annotation pipeline the same as paragraph text.
export function flattenDoc(doc: Doc): {
  text: string;
  units: FlattenedUnit[];
} {
  const texts: string[] = [];
  const units: FlattenedUnit[] = [];
  let cursor = 0;
  let blockIndex = 0;

  for (const block of doc.children) {
    if (isParagraph(block)) {
      const { text: unitText, offsets } = flattenNodes(block.children);
      units.push({
        blockIndex,
        start: cursor,
        end: cursor + unitText.length,
        nodes: offsets,
      });
      texts.push(unitText);
      cursor += unitText.length + PARAGRAPH_SEPARATOR.length;
    } else if (isListBlock(block)) {
      block.items.forEach((item, itemIndex) => {
        const { text: unitText, offsets } = flattenNodes(item.children);
        units.push({
          blockIndex,
          itemIndex,
          start: cursor,
          end: cursor + unitText.length,
          nodes: offsets,
        });
        texts.push(unitText);
        cursor += unitText.length + PARAGRAPH_SEPARATOR.length;
      });
    }

    blockIndex += 1;
  }

  return { text: texts.join(PARAGRAPH_SEPARATOR), units };
}
