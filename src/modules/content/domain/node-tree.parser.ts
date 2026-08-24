import { InvalidNodeTreeError } from '../errors/invalid-node-tree.error.js';
import type {
  Block,
  Doc,
  GrammarOnlySpanNode,
  HeadingLevel,
  LinkNode,
  ListBlock,
  ListItem,
  Mark,
  Node,
  Paragraph,
  PhraseSpanNode,
  SpanNode,
  TextNode,
  WordSpanNode,
} from './node-tree.types.js';
import { MARKS, SPAN_KINDS } from './node-tree.types.js';

const HEADING_LEVELS: readonly HeadingLevel[] = [1, 2, 3, 4, 5, 6];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseMarks(value: unknown, context: string): Mark[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    !value.every((mark) => (MARKS as readonly string[]).includes(mark))
  ) {
    throw new InvalidNodeTreeError(
      `${context} has invalid "marks": ${JSON.stringify(value)}`,
    );
  }

  return value as Mark[];
}

function parseTextNode(value: Record<string, unknown>): TextNode {
  if (typeof value.text !== 'string') {
    throw new InvalidNodeTreeError('text node missing "text" string');
  }

  const node: TextNode = { type: 'text', text: value.text };
  const marks = parseMarks(value.marks, 'text node');
  if (marks) {
    node.marks = marks;
  }

  return node;
}

function parseLinkNode(value: Record<string, unknown>): LinkNode {
  if (typeof value.text !== 'string') {
    throw new InvalidNodeTreeError('link node missing "text" string');
  }

  if (typeof value.href !== 'string' || value.href.length === 0) {
    throw new InvalidNodeTreeError(
      'link node missing a non-empty "href" string',
    );
  }

  const node: LinkNode = { type: 'link', text: value.text, href: value.href };
  const marks = parseMarks(value.marks, 'link node');
  if (marks) {
    node.marks = marks;
  }

  return node;
}

function parseSpanGrammarConstruct(
  value: Record<string, unknown>,
): string | undefined {
  return typeof value.grammarConstruct === 'string'
    ? value.grammarConstruct
    : undefined;
}

function parseWordSpanNode(
  value: Record<string, unknown>,
  text: string,
  marks: Mark[] | undefined,
): WordSpanNode {
  if (typeof value.wordDefinitionId !== 'string') {
    throw new InvalidNodeTreeError(
      'word span node missing "wordDefinitionId" string',
    );
  }
  if (typeof value.pos !== 'string') {
    throw new InvalidNodeTreeError('word span node missing "pos" string');
  }

  const node: WordSpanNode = {
    type: 'span',
    kind: 'word',
    text,
    wordDefinitionId: value.wordDefinitionId,
    pos: value.pos,
  };
  const grammarConstruct = parseSpanGrammarConstruct(value);
  if (grammarConstruct) {
    node.grammarConstruct = grammarConstruct;
  }
  if (marks) {
    node.marks = marks;
  }

  return node;
}

function parsePhraseSpanNode(
  value: Record<string, unknown>,
  text: string,
  marks: Mark[] | undefined,
): PhraseSpanNode {
  if (typeof value.phraseId !== 'string') {
    throw new InvalidNodeTreeError(
      'phrase span node missing "phraseId" string',
    );
  }

  const node: PhraseSpanNode = {
    type: 'span',
    kind: 'phrase',
    text,
    phraseId: value.phraseId,
  };
  const grammarConstruct = parseSpanGrammarConstruct(value);
  if (grammarConstruct) {
    node.grammarConstruct = grammarConstruct;
  }
  if (marks) {
    node.marks = marks;
  }

  return node;
}

function parseGrammarOnlySpanNode(
  value: Record<string, unknown>,
  text: string,
  marks: Mark[] | undefined,
): GrammarOnlySpanNode {
  const node: GrammarOnlySpanNode = {
    type: 'span',
    kind: 'grammar_only',
    text,
  };
  const grammarConstruct = parseSpanGrammarConstruct(value);
  if (grammarConstruct) {
    node.grammarConstruct = grammarConstruct;
  }
  if (marks) {
    node.marks = marks;
  }

  return node;
}

function parseSpanNode(value: Record<string, unknown>): SpanNode {
  if (typeof value.text !== 'string') {
    throw new InvalidNodeTreeError('span node missing "text" string');
  }

  if (
    typeof value.kind !== 'string' ||
    !(SPAN_KINDS as readonly string[]).includes(value.kind)
  ) {
    throw new InvalidNodeTreeError(
      `span node has invalid "kind": ${String(value.kind)}`,
    );
  }

  const marks = parseMarks(value.marks, 'span node');

  if (value.kind === 'word') {
    return parseWordSpanNode(value, value.text, marks);
  }
  if (value.kind === 'phrase') {
    return parsePhraseSpanNode(value, value.text, marks);
  }
  return parseGrammarOnlySpanNode(value, value.text, marks);
}

function parseNode(value: unknown): Node {
  if (!isRecord(value)) {
    throw new InvalidNodeTreeError('node must be an object');
  }

  if (value.type === 'text') {
    return parseTextNode(value);
  }
  if (value.type === 'link') {
    return parseLinkNode(value);
  }
  if (value.type === 'span') {
    return parseSpanNode(value);
  }

  throw new InvalidNodeTreeError(`unknown node type: ${String(value.type)}`);
}

function parseParagraph(value: Record<string, unknown>): Paragraph {
  if (!Array.isArray(value.children)) {
    throw new InvalidNodeTreeError('paragraph missing "children" array');
  }

  const paragraph: Paragraph = {
    type: 'paragraph',
    children: value.children.map(parseNode),
  };

  if (value.level !== undefined) {
    if (!(HEADING_LEVELS as readonly unknown[]).includes(value.level)) {
      throw new InvalidNodeTreeError(
        `paragraph has invalid "level": ${String(value.level)}`,
      );
    }
    paragraph.level = value.level as HeadingLevel;
  }

  return paragraph;
}

function parseListItem(value: unknown): ListItem {
  if (!isRecord(value) || !Array.isArray(value.children)) {
    throw new InvalidNodeTreeError('list item missing "children" array');
  }

  return { children: value.children.map(parseNode) };
}

function parseListBlock(value: Record<string, unknown>): ListBlock {
  if (typeof value.ordered !== 'boolean') {
    throw new InvalidNodeTreeError('list block missing boolean "ordered"');
  }

  if (!Array.isArray(value.items)) {
    throw new InvalidNodeTreeError('list block missing "items" array');
  }

  return {
    type: 'list',
    ordered: value.ordered,
    items: value.items.map(parseListItem),
  };
}

function parseBlock(value: unknown): Block {
  if (!isRecord(value)) {
    throw new InvalidNodeTreeError('block must be an object');
  }

  if (value.type === 'paragraph') {
    return parseParagraph(value);
  }
  if (value.type === 'list') {
    return parseListBlock(value);
  }

  throw new InvalidNodeTreeError(`unknown block type: ${String(value.type)}`);
}

export function parseDoc(value: unknown): Doc {
  if (!isRecord(value) || value.type !== 'doc') {
    throw new InvalidNodeTreeError('doc must have type "doc"');
  }

  if (!Array.isArray(value.children)) {
    throw new InvalidNodeTreeError('doc missing "children" array');
  }

  return { type: 'doc', children: value.children.map(parseBlock) };
}
