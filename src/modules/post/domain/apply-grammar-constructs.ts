import type {
  Block,
  GrammarOnlySpanNode,
  Mark,
  Node,
  Paragraph,
  PhraseSpanNode,
  TextNode,
  WordSpanNode,
} from './node-tree.types.js';
import { contains, type SpanRange, spansOverlap } from './span-range.js';

// F3 (local-verification 2026-09-06): the ai_grammar stage writes
// `grammar_matches` (spaCy token ranges) for the analytical layer, but the
// reader resolves grammar highlighting from node-tree `span.grammarConstruct`
// only — and nothing ever wrote that, so `annotations.grammar` was always
// empty. These two helpers let TagGrammarHandler paint the construction slug
// onto the post_parts node tree from the same parsed spans, as a second phase
// after `grammar_matches`.
//
// Coordinates are flattened-unit char offsets — the exact system
// flattenParagraph / spliceSpans work in (PLAN.md §6, §12).

// A `grammar_only` span is splittable here, like a plain text node: a later,
// shorter construction painted over part of an earlier one re-wraps only the
// covered slice, so on shared tokens the shorter (more specific) slug wins
// (the V1 nested-construct rule). A `word` / `phrase` span or a `link` can't be
// cut, so a range that only partially covers one skips the whole match.
function isSplittable(node: Node): node is TextNode | GrammarOnlySpanNode {
  return (
    node.type === 'text' ||
    (node.type === 'span' && node.kind === 'grammar_only')
  );
}

function textPiece(text: string, marks: Mark[] | undefined): TextNode {
  return marks ? { type: 'text', text, marks } : { type: 'text', text };
}

function grammarOnlyPiece(
  text: string,
  grammarConstruct: string | undefined,
  marks: Mark[] | undefined,
): GrammarOnlySpanNode {
  const node: GrammarOnlySpanNode = {
    type: 'span',
    kind: 'grammar_only',
    text,
  };
  if (grammarConstruct !== undefined) {
    node.grammarConstruct = grammarConstruct;
  }
  if (marks) {
    node.marks = marks;
  }
  return node;
}

// Lead/trail slice of a split node, keeping its own type (and, for a
// grammar_only node, its existing slug — only the covered middle takes the new
// one).
function splitPiece(
  node: TextNode | GrammarOnlySpanNode,
  text: string,
): TextNode | GrammarOnlySpanNode {
  return node.type === 'text'
    ? textPiece(text, node.marks)
    : grammarOnlyPiece(text, node.grammarConstruct, node.marks);
}

// True when `range` overlaps a node it cannot cut cleanly — a `word` / `phrase`
// span it only partially covers, or any `link` (kept atomic). The caller then
// drops the whole match with a warn (P8).
function rangeCrossesUnsplittable(nodes: Node[], range: SpanRange): boolean {
  let cursor = 0;
  for (const node of nodes) {
    const nodeRange: SpanRange = {
      start: cursor,
      end: cursor + node.text.length,
    };
    cursor = nodeRange.end;
    if (!spansOverlap(nodeRange, range) || isSplittable(node)) {
      continue;
    }
    if (node.type === 'link' || !contains(range, nodeRange)) {
      return true;
    }
  }
  return false;
}

// One node's contribution to the painted output. A node fully outside the
// range is passed through; a `word` / `phrase` span fully inside just has its
// slug overwritten (never nested, matching spliceSpans); a splittable node is
// cut at the range edges with the covered middle wrapped in a grammar_only
// span.
function paintNode(
  node: Node,
  nodeStart: number,
  range: SpanRange,
  slug: string,
): Node[] {
  const nodeRange: SpanRange = {
    start: nodeStart,
    end: nodeStart + node.text.length,
  };
  if (!spansOverlap(nodeRange, range)) {
    return [node];
  }
  if (!isSplittable(node)) {
    return node.type === 'span'
      ? [{ ...node, grammarConstruct: slug }]
      : [node];
  }

  const localStart = Math.max(range.start, nodeRange.start) - nodeRange.start;
  const localEnd = Math.min(range.end, nodeRange.end) - nodeRange.start;
  const lead = node.text.slice(0, localStart);
  const trail = node.text.slice(localEnd);

  const pieces: Node[] = [];
  if (lead) {
    pieces.push(splitPiece(node, lead));
  }
  pieces.push(
    grammarOnlyPiece(node.text.slice(localStart, localEnd), slug, node.marks),
  );
  if (trail) {
    pieces.push(splitPiece(node, trail));
  }
  return pieces;
}

// Paints `slug` as the grammarConstruct across the half-open flattened-unit
// range `[range.start, range.end)` of `nodes`, returning a NEW Node[] — the
// input is never mutated. Returns `null` when the range only partially covers
// a `word` / `phrase` span or touches a `link` (the caller drops that match
// with a warn, P8).
export function paintGrammarConstruct(
  nodes: Node[],
  range: SpanRange,
  slug: string,
): Node[] | null {
  if (rangeCrossesUnsplittable(nodes, range)) {
    return null;
  }

  const out: Node[] = [];
  let cursor = 0;
  for (const node of nodes) {
    out.push(...paintNode(node, cursor, range, slug));
    cursor += node.text.length;
  }
  return out;
}

function stripNode(node: Node): Node {
  if (node.type === 'text' || node.type === 'link') {
    return node;
  }
  if (node.kind === 'grammar_only') {
    return textPiece(node.text, node.marks);
  }
  if (node.kind === 'word') {
    const bare: WordSpanNode = {
      type: 'span',
      kind: 'word',
      text: node.text,
      wordDefinitionId: node.wordDefinitionId,
      pos: node.pos,
    };
    if (node.marks) {
      bare.marks = node.marks;
    }
    return bare;
  }
  const bare: PhraseSpanNode = {
    type: 'span',
    kind: 'phrase',
    text: node.text,
    phraseId: node.phraseId,
  };
  if (node.marks) {
    bare.marks = node.marks;
  }
  return bare;
}

function marksEqual(a: Mark[] | undefined, b: Mark[] | undefined): boolean {
  if (a === undefined || b === undefined) {
    return a === b;
  }
  return a.length === b.length && a.every((mark) => b.includes(mark));
}

function mergeAdjacentText(nodes: Node[]): Node[] {
  const out: Node[] = [];
  for (const node of nodes) {
    const prev = out[out.length - 1];
    if (
      node.type === 'text' &&
      prev?.type === 'text' &&
      marksEqual(prev.marks, node.marks)
    ) {
      out[out.length - 1] = textPiece(prev.text + node.text, prev.marks);
      continue;
    }
    out.push(node);
  }
  return out;
}

function stripNodes(nodes: Node[]): Node[] {
  return mergeAdjacentText(nodes.map(stripNode));
}

// Removes every grammarConstruct a prior ai_grammar run painted: each `word` /
// `phrase` span loses its slug, each `grammar_only` span collapses back into a
// plain text node (adjacent text merged). The idempotency primitive — every
// run does `strip -> repaint` from the current model output, so a partial
// stage retry never stacks the previous run's paint (P7 rebuild-style).
export function stripGrammarConstructs(block: Block): Block {
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
