export type Mark = 'bold' | 'italic';

export const MARKS: readonly Mark[] = ['bold', 'italic'];

export interface TextNode {
  type: 'text';
  text: string;
  marks?: Mark[];
}

export interface LinkNode {
  type: 'link';
  text: string;
  href: string;
  marks?: Mark[];
}

export type SpanKind = 'word' | 'phrase' | 'grammar_only';

export const SPAN_KINDS: readonly SpanKind[] = [
  'word',
  'phrase',
  'grammar_only',
];

interface BaseSpanNode {
  type: 'span';
  text: string;
  grammarConstruct?: string;
  marks?: Mark[];
}

export interface WordSpanNode extends BaseSpanNode {
  kind: 'word';
  wordDefinitionId: string;
  pos: string;
}

export interface PhraseSpanNode extends BaseSpanNode {
  kind: 'phrase';
  phraseId: string;
}

export interface GrammarOnlySpanNode extends BaseSpanNode {
  kind: 'grammar_only';
}

export type SpanNode = WordSpanNode | PhraseSpanNode | GrammarOnlySpanNode;

// Inline (leaf) nodes — every variant carries `.text`, which is all
// flatten/splice ever read; `type` only matters for rendering and for how
// spliceSpans is allowed to split the node.
export type Node = TextNode | LinkNode | SpanNode;

export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export interface Paragraph {
  type: 'paragraph';
  // Present => this paragraph renders as a heading of that level. Kept on
  // Paragraph rather than as a separate node type so the AI annotation
  // pipeline (flattenDoc/spliceSpans) keeps treating it exactly like prose.
  level?: HeadingLevel;
  children: Node[];
}

export interface ListItem {
  children: Node[];
}

// List items go through the same flatten/splice pipeline as paragraphs
// (flattenDoc emits one FlattenedUnit per ListItem, spliceSpansIntoListItem
// inserts word/phrase/grammar spans into ListItem.children) — reversed from
// the original Phase 0 "presentation-only" decision on 2026-08-24.
export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: ListItem[];
}

export type Block = Paragraph | ListBlock;

export interface Doc {
  type: 'doc';
  children: Block[];
}
