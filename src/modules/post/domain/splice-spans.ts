import { DuplicateSpanInsertError } from '../errors/duplicate-span-insert.error.js';
import { OverlappingSpanInsertError } from '../errors/overlapping-span-insert.error.js';
import { SpanInsertOutOfNodeError } from '../errors/span-insert-out-of-node.error.js';
import { flattenNodes, type NodeOffset } from './flatten.js';
import type {
  GrammarOnlySpanNode,
  LinkNode,
  ListItem,
  Mark,
  Node,
  Paragraph,
  PhraseSpanNode,
  SpanNode,
  TextNode,
  WordSpanNode,
} from './node-tree.types.js';
import { contains } from './span-range.js';

interface BaseSpanInsert {
  start: number;
  end: number;
  grammarConstruct?: string;
}

export interface WordSpanInsert extends BaseSpanInsert {
  kind: 'word';
  wordDefinitionId: string;
  pos: string;
}

export interface PhraseSpanInsert extends BaseSpanInsert {
  kind: 'phrase';
  phraseId: string;
}

export interface GrammarOnlySpanInsert extends BaseSpanInsert {
  kind: 'grammar_only';
}

export type SpanInsert =
  | WordSpanInsert
  | PhraseSpanInsert
  | GrammarOnlySpanInsert;

type SplittableNode = TextNode | LinkNode;

function childIndexFor(
  offsets: NodeOffset[],
  start: number,
  end: number,
): number {
  const match = offsets.find((offset) => contains(offset, { start, end }));
  if (!match) {
    throw new SpanInsertOutOfNodeError(start, end);
  }

  return match.index;
}

// Builds a lead/trail piece of the same node type (and marks/href) as the node
// being split, just with a slice of its text.
function clonePiece(source: SplittableNode, text: string): SplittableNode {
  if (source.type === 'link') {
    const piece: LinkNode = { type: 'link', text, href: source.href };
    if (source.marks) {
      piece.marks = source.marks;
    }
    return piece;
  }

  const piece: TextNode = { type: 'text', text };
  if (source.marks) {
    piece.marks = source.marks;
  }
  return piece;
}

// The new SpanNode inherits the source node's marks (so an annotated word
// inside a bold run still renders bold), but never its href — annotating a
// run inside a link turns that specific run into a word/phrase lookup, not a
// link, while the untouched lead/trail pieces keep the original href.
function buildSpanNode(
  insert: SpanInsert,
  text: string,
  marks?: Mark[],
): SpanNode {
  if (insert.kind === 'word') {
    const node: WordSpanNode = {
      type: 'span',
      kind: 'word',
      text,
      wordDefinitionId: insert.wordDefinitionId,
      pos: insert.pos,
    };
    if (insert.grammarConstruct !== undefined) {
      node.grammarConstruct = insert.grammarConstruct;
    }
    if (marks) {
      node.marks = marks;
    }
    return node;
  }

  if (insert.kind === 'phrase') {
    const node: PhraseSpanNode = {
      type: 'span',
      kind: 'phrase',
      text,
      phraseId: insert.phraseId,
    };
    if (insert.grammarConstruct !== undefined) {
      node.grammarConstruct = insert.grammarConstruct;
    }
    if (marks) {
      node.marks = marks;
    }
    return node;
  }

  const node: GrammarOnlySpanNode = {
    type: 'span',
    kind: 'grammar_only',
    text,
  };
  if (insert.grammarConstruct !== undefined) {
    node.grammarConstruct = insert.grammarConstruct;
  }
  if (marks) {
    node.marks = marks;
  }
  return node;
}

// Splits a TextNode/LinkNode at each insert's boundaries into lead/span/trail
// pieces. Inserts must already be sorted and non-overlapping relative to
// `childStart` (the paragraph-relative offset where this node's own text
// begins).
function splitNode(
  node: SplittableNode,
  childStart: number,
  inserts: SpanInsert[],
): Node[] {
  const sorted = [...inserts].sort((a, b) => a.start - b.start);
  const pieces: Node[] = [];
  let cursor = 0;

  for (const insert of sorted) {
    const localStart = insert.start - childStart;
    const localEnd = insert.end - childStart;

    if (localStart < cursor) {
      throw new OverlappingSpanInsertError(insert.start, insert.end);
    }

    if (localStart > cursor) {
      pieces.push(clonePiece(node, node.text.slice(cursor, localStart)));
    }

    pieces.push(
      buildSpanNode(insert, node.text.slice(localStart, localEnd), node.marks),
    );
    cursor = localEnd;
  }

  if (cursor < node.text.length) {
    pieces.push(clonePiece(node, node.text.slice(cursor)));
  }

  return pieces;
}

// An insert landing inside an existing SpanNode never nests a new span. Only
// that span's grammarConstruct is overwritten; kind/wordDefinitionId/pos/text
// /marks are left untouched and the insert's own kind/wordDefinitionId/pos
// are ignored — this is the grammar-tagging-over-existing-word/phrase-span
// case.
function spliceIntoSpanNode(node: SpanNode, inserts: SpanInsert[]): SpanNode {
  const [first, ...rest] = inserts;
  if (!first) {
    return node;
  }

  const duplicate = rest[0];
  if (duplicate) {
    throw new DuplicateSpanInsertError(duplicate.start, duplicate.end);
  }

  return { ...node, grammarConstruct: first.grammarConstruct };
}

// Splices `inserts` into `children`, returning a NEW Node[] — the input is
// never mutated. All-or-nothing: any invalid insert throws before any output
// is constructed, so a caught error means zero partial mutation occurred.
// Shared by spliceSpans (Paragraph) and spliceSpansIntoListItem (ListItem) —
// both flatten/splice the exact same Node[] shape.
export function spliceSpansIntoNodes(
  children: Node[],
  inserts: SpanInsert[],
): Node[] {
  const { offsets } = flattenNodes(children);

  const insertsByChildIndex = new Map<number, SpanInsert[]>();
  for (const insert of inserts) {
    const childIndex = childIndexFor(offsets, insert.start, insert.end);
    const existing = insertsByChildIndex.get(childIndex);
    if (existing) {
      existing.push(insert);
    } else {
      insertsByChildIndex.set(childIndex, [insert]);
    }
  }

  return children.flatMap((node, index) => {
    const nodeInserts = insertsByChildIndex.get(index);
    if (!nodeInserts) {
      return [node];
    }

    if (node.type === 'span') {
      return [spliceIntoSpanNode(node, nodeInserts)];
    }

    const offset = offsets[index];
    if (!offset) {
      return [node];
    }

    return splitNode(node, offset.start, nodeInserts);
  });
}

// Splices `inserts` into `paragraph.children`, returning a NEW Paragraph —
// see spliceSpansIntoNodes for the all-or-nothing contract.
export function spliceSpans(
  paragraph: Paragraph,
  inserts: SpanInsert[],
): Paragraph {
  const children = spliceSpansIntoNodes(paragraph.children, inserts);

  const result: Paragraph = { type: 'paragraph', children };
  if (paragraph.level !== undefined) {
    result.level = paragraph.level;
  }

  return result;
}

// Splices `inserts` into `item.children`, returning a NEW ListItem — see
// spliceSpansIntoNodes for the all-or-nothing contract.
export function spliceSpansIntoListItem(
  item: ListItem,
  inserts: SpanInsert[],
): ListItem {
  return { children: spliceSpansIntoNodes(item.children, inserts) };
}
