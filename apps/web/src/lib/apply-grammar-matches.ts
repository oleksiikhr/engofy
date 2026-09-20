// Places grammar usage-point matches (`annotations.grammarMatches`, char ranges
// in each block unit's flattened text) onto the node tree as
// `grammarUsagePointId` labels, independent of the word/phrase spans. Every
// match is labelled whatever its state for the viewer; `renderDoc` turns the
// labels into `data-grammar-usage-point-id` wrappers and flags the settled
// ones.
//
// Text nodes and `grammar_only` spans are cut at range edges. A `word` /
// `phrase` span or a `link` is atomic: a match that only partly covers one is
// dropped whole (the same rule as the backend's grammarConstruct paint).
// Where matches overlap, the shortest wins, so every char carries at most one
// usage point.

import type { Block, Doc, GrammarMatch, InlineNode } from './types';

interface Range {
  start: number;
  end: number;
  id: string;
}

const NO_OWNER = -1;

function isSplittable(node: InlineNode): boolean {
  return (
    node.type === 'text' ||
    (node.type === 'span' && node.kind === 'grammar_only')
  );
}

function crossesAtomicNode(nodes: InlineNode[], range: Range): boolean {
  let cursor = 0;
  for (const node of nodes) {
    const start = cursor;
    const end = cursor + node.text.length;
    cursor = end;
    if (isSplittable(node) || range.start >= end || start >= range.end) {
      continue;
    }
    if (range.start > start || range.end < end) {
      return true;
    }
  }
  return false;
}

// Per-char index into `ranges` of the shortest range covering it, or NO_OWNER.
function paintOwners(length: number, ranges: Range[]): Int32Array {
  const owners = new Int32Array(length).fill(NO_OWNER);
  const longestFirst = ranges
    .map((_, index) => index)
    .sort(
      (a, b) =>
        ranges[b].end - ranges[b].start - (ranges[a].end - ranges[a].start) ||
        ranges[a].start - ranges[b].start ||
        a - b,
    );
  for (const index of longestFirst) {
    owners.fill(index, ranges[index].start, ranges[index].end);
  }
  return owners;
}

function withLabel(node: InlineNode, text: string, id?: string): InlineNode {
  const piece = { ...node, text };
  if (id === undefined) {
    return piece;
  }
  return { ...piece, grammarUsagePointId: id };
}

function labelNodes(
  nodes: InlineNode[],
  matches: GrammarMatch[],
): InlineNode[] {
  const length = nodes.reduce((sum, node) => sum + node.text.length, 0);
  const ranges = matches
    .filter(
      (match) =>
        match.charStart < match.charEnd &&
        match.charStart >= 0 &&
        match.charEnd <= length,
    )
    .map((match) => ({
      start: match.charStart,
      end: match.charEnd,
      id: match.grammarUsagePointId,
    }))
    .filter((range) => !crossesAtomicNode(nodes, range));
  if (ranges.length === 0) {
    return nodes;
  }

  const owners = paintOwners(length, ranges);
  const idAt = (pos: number) =>
    owners[pos] === NO_OWNER ? undefined : ranges[owners[pos]].id;

  const out: InlineNode[] = [];
  let cursor = 0;
  for (const node of nodes) {
    const start = cursor;
    const end = cursor + node.text.length;
    cursor = end;

    if (start === end) {
      out.push(node);
    } else if (!isSplittable(node)) {
      out.push(withLabel(node, node.text, idAt(start)));
    } else {
      // Cut into runs of equal owner.
      let runStart = start;
      for (let pos = start + 1; pos <= end; pos++) {
        if (pos === end || owners[pos] !== owners[runStart]) {
          out.push(
            withLabel(
              node,
              node.text.slice(runStart - start, pos - start),
              idAt(runStart),
            ),
          );
          runStart = pos;
        }
      }
    }
  }
  return out;
}

export function applyGrammarMatches(doc: Doc, matches: GrammarMatch[]): Doc {
  if (matches.length === 0) {
    return doc;
  }

  const inUnit = (blockIndex: number, itemIndex: number | null) =>
    matches.filter(
      (match) =>
        match.blockIndex === blockIndex && match.itemIndex === itemIndex,
    );

  const children = doc.children.map((block, blockIndex): Block => {
    if (block.type === 'list') {
      return {
        ...block,
        items: block.items.map((item, itemIndex) => ({
          ...item,
          children: labelNodes(item.children, inUnit(blockIndex, itemIndex)),
        })),
      };
    }
    return {
      ...block,
      children: labelNodes(block.children, inUnit(blockIndex, null)),
    };
  });

  return { ...doc, children };
}
