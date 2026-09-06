import { marked, type Token, type Tokens } from 'marked';
import { isSafeLinkHref } from '../../../core/helpers/url.helper.js';
import type {
  Block,
  Doc,
  HeadingLevel,
  ListItem,
  Mark,
  Node,
} from '../domain/node-tree.types.js';

function wrapText(text: string, marks: Mark[]): Node[] {
  return text
    ? [
        {
          type: 'text',
          text,
          ...(marks.length > 0 ? { marks: [...marks] } : {}),
        },
      ]
    : [];
}

function wrapLink(token: Tokens.Link, marks: Mark[]): Node[] {
  if (!token.text) {
    return [];
  }

  // Reject non-`http(s)`/`mailto` schemes (`javascript:`, `data:`, …) before the
  // href reaches a stored LinkNode — degrade to plain text, keeping what reads.
  if (!isSafeLinkHref(token.href)) {
    return wrapText(token.text, marks);
  }

  return [
    {
      type: 'link',
      text: token.text,
      href: token.href,
      ...(marks.length > 0 ? { marks: [...marks] } : {}),
    },
  ];
}

function convertInlineToken(token: Token, marks: Mark[]): Node[] {
  switch (token.type) {
    case 'strong':
      return convertInlineTokens((token as Tokens.Strong).tokens, [
        ...marks,
        'bold',
      ]);
    case 'em':
      return convertInlineTokens((token as Tokens.Em).tokens, [
        ...marks,
        'italic',
      ]);
    case 'link':
      return wrapLink(token as Tokens.Link, marks);
    default: {
      const text =
        'text' in token && typeof token.text === 'string' ? token.text : '';
      return wrapText(text, marks);
    }
  }
}

function convertInlineTokens(tokens: Token[], marks: Mark[]): Node[] {
  return tokens.flatMap((token) => convertInlineToken(token, marks));
}

function listItemInlineTokens(item: Tokens.ListItem): Token[] {
  const [first] = item.tokens;
  if (first && 'tokens' in first && first.tokens) {
    return first.tokens;
  }

  return item.tokens;
}

function convertListToken(token: Tokens.List): Block {
  const items: ListItem[] = token.items.map((item) => ({
    children: convertInlineTokens(listItemInlineTokens(item), []),
  }));

  return { type: 'list', ordered: token.ordered, items };
}

function convertBlockToken(token: Token): Block | undefined {
  if (token.type === 'heading') {
    const heading = token as Tokens.Heading;
    return {
      type: 'paragraph',
      level: heading.depth as HeadingLevel,
      children: convertInlineTokens(heading.tokens, []),
    };
  }

  if (token.type === 'paragraph') {
    const paragraph = token as Tokens.Paragraph;
    return {
      type: 'paragraph',
      children: convertInlineTokens(paragraph.tokens, []),
    };
  }

  if (token.type === 'list') {
    return convertListToken(token as Tokens.List);
  }

  return undefined;
}

export function convertMarkdownToDoc(rawText: string): Doc {
  const tokens = marked.lexer(rawText);
  const children = tokens
    .map(convertBlockToken)
    .filter((block): block is Block => block !== undefined);

  return { type: 'doc', children };
}
