import { flattenNodes } from '../../post/domain/flatten.js';
import type {
  Block,
  Node,
  SpanNode,
} from '../../post/domain/node-tree.types.js';

export interface SpanOccurrence {
  unitIndex: number;
  start: number;
  end: number;
}

interface BlockUnit {
  unitIndex: number;
  children: Node[];
}

function blockUnits(block: Block): BlockUnit[] {
  if (block.type === 'list') {
    return block.items.map((item, unitIndex) => ({
      unitIndex,
      children: item.children,
    }));
  }
  return [{ unitIndex: 0, children: block.children }];
}

// The word/phrase span key this occurrence resolves to, in the same shape as
// `get-practice-queue`'s own card `targetKey` (`word:<wordDefinitionId>` /
// `phrase:<phraseId>`), so both sides of the bridge agree. Grammar spans have
// no key here — practice-redesign зріз 3 bridges grammar via `grammar_matches`
// instead of this node-tree index.
function spanKey(span: SpanNode): string | null {
  if (span.kind === 'word') {
    return `word:${span.wordDefinitionId}`;
  }
  if (span.kind === 'phrase') {
    return `phrase:${span.phraseId}`;
  }
  return null;
}

// Every word/phrase span's char range within one PostPart block, keyed the
// same way as the practice queue's card target. The range shares the
// coordinate system `Sentence.charStart/charEnd` is anchored to for the same
// (postPartId, unitIndex) — see `Sentence`'s own doc comment. First
// occurrence per key wins if a block repeats a span.
export function indexBlockSpans(block: Block): Map<string, SpanOccurrence> {
  const index = new Map<string, SpanOccurrence>();
  for (const unit of blockUnits(block)) {
    const { offsets } = flattenNodes(unit.children);
    unit.children.forEach((node, i) => {
      if (node.type !== 'span') {
        return;
      }
      const key = spanKey(node);
      if (!key || index.has(key)) {
        return;
      }
      index.set(key, {
        unitIndex: unit.unitIndex,
        start: offsets[i].start,
        end: offsets[i].end,
      });
    });
  }
  return index;
}

// Does a spaCy sentence's char range contain this span occurrence — i.e. is
// this the sentence the word/phrase actually occurred in?
export function sentenceContainsSpan(
  sentence: { charStart: number; charEnd: number },
  occurrence: SpanOccurrence,
): boolean {
  return (
    sentence.charStart < occurrence.end && sentence.charEnd > occurrence.start
  );
}
