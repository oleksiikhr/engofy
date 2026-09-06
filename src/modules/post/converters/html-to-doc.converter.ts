import {
  HTMLElement,
  type Node as HtmlNode,
  NodeType,
  parse,
} from 'node-html-parser';
import { isSafeLinkHref } from '../../../core/helpers/url.helper.js';
import type {
  Block,
  Doc,
  HeadingLevel,
  ListItem,
  Mark,
  Node as TreeNode,
} from '../domain/node-tree.types.js';

const HEADING_TAGS: Record<string, HeadingLevel> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
};

function wrapText(text: string, marks: Mark[]): TreeNode[] {
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

function wrapLink(el: HTMLElement, marks: Mark[]): TreeNode[] {
  const href = el.getAttribute('href') ?? '';
  const text = el.text;

  if (!text) {
    return [];
  }

  // Reject non-`http(s)`/`mailto` schemes (`javascript:`, `data:`, …) before the
  // href reaches a stored LinkNode — degrade to plain text, keeping what reads.
  if (!isSafeLinkHref(href)) {
    return wrapText(text, marks);
  }

  return [
    {
      type: 'link',
      text,
      href,
      ...(marks.length > 0 ? { marks: [...marks] } : {}),
    },
  ];
}

function convertInlineElement(el: HTMLElement, marks: Mark[]): TreeNode[] {
  const tag = el.tagName?.toLowerCase();

  if (tag === 'strong' || tag === 'b') {
    return el.childNodes.flatMap((child) =>
      convertInlineNode(child, [...marks, 'bold']),
    );
  }

  if (tag === 'em' || tag === 'i') {
    return el.childNodes.flatMap((child) =>
      convertInlineNode(child, [...marks, 'italic']),
    );
  }

  if (tag === 'a') {
    return wrapLink(el, marks);
  }

  // Unknown inline element (e.g. <span>) — pass through, keeping marks.
  return el.childNodes.flatMap((child) => convertInlineNode(child, marks));
}

function convertInlineNode(node: HtmlNode, marks: Mark[]): TreeNode[] {
  if (node.nodeType === NodeType.TEXT_NODE) {
    return wrapText(node.text, marks);
  }

  if (!(node instanceof HTMLElement)) {
    return [];
  }

  return convertInlineElement(node, marks);
}

function convertInlineChildren(el: HTMLElement): TreeNode[] {
  return el.childNodes.flatMap((child) => convertInlineNode(child, []));
}

function convertListElement(el: HTMLElement): Block {
  const items: ListItem[] = el
    .querySelectorAll(':scope > li')
    .map((li) => ({ children: convertInlineChildren(li) }));

  return { type: 'list', ordered: el.tagName?.toLowerCase() === 'ol', items };
}

function convertBlockElement(el: HTMLElement): Block | undefined {
  const tag = el.tagName?.toLowerCase();

  if (tag && tag in HEADING_TAGS) {
    return {
      type: 'paragraph',
      level: HEADING_TAGS[tag],
      children: convertInlineChildren(el),
    };
  }

  if (tag === 'p') {
    return { type: 'paragraph', children: convertInlineChildren(el) };
  }

  if (tag === 'ul' || tag === 'ol') {
    return convertListElement(el);
  }

  return undefined;
}

// Top-level block elements only: descend through non-block wrappers (<div>, …)
// but stop at the first block on each path, so a <ul>/<ol> nested inside a <li>
// is not also emitted as its own top-level block (which duplicated its content).
function collectBlockElements(node: HtmlNode): HTMLElement[] {
  if (!(node instanceof HTMLElement)) {
    return [];
  }

  const tag = node.tagName?.toLowerCase();
  if (
    tag === 'p' ||
    tag === 'ul' ||
    tag === 'ol' ||
    (tag && tag in HEADING_TAGS)
  ) {
    return [node];
  }

  return node.childNodes.flatMap(collectBlockElements);
}

export function convertHtmlToDoc(rawText: string): Doc {
  const root = parse(rawText);
  const blockElements = root.childNodes.flatMap(collectBlockElements);

  const children = blockElements
    .map(convertBlockElement)
    .filter((block): block is Block => block !== undefined);

  return { type: 'doc', children };
}
