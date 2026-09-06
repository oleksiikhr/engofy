// Server-side node-tree -> HTML for the reader page (PLAN.md §6). The inline
// analysis comes from the node-tree spans the API resolved, NOT the parallel
// spaCy layer. Output is injected with `set:html`, so every text value is
// escaped here and only the tag/attribute scaffold is ours.

import type { Block, Doc, InlineNode, Mark, SpanNode } from './types';

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPE[ch]);
}

function wrapMarks(html: string, marks: Mark[] | undefined): string {
  let out = html;
  for (const mark of marks ?? []) {
    if (mark === 'bold') {
      out = `<strong>${out}</strong>`;
    } else if (mark === 'italic') {
      out = `<em>${out}</em>`;
    }
  }
  return out;
}

// Classes + data-* keys that the tooltip client script reads. A word/phrase
// span can also carry a grammar construct, so the classes stack.
function spanAttrs(span: SpanNode): string {
  const classes: string[] = [];
  const data: string[] = [];
  if (span.kind === 'word') {
    classes.push('word');
    data.push(`data-word="${esc(span.wordDefinitionId)}"`);
  } else if (span.kind === 'phrase') {
    classes.push('phrase');
    data.push(`data-phrase="${esc(span.phraseId)}"`);
  }
  if (span.grammarConstruct) {
    classes.push('grammar');
    data.push(`data-grammar="${esc(span.grammarConstruct)}"`);
  }
  if (classes.length === 0) {
    classes.push('grammar');
  }
  return `class="${classes.join(' ')}" tabindex="0" role="button" ${data.join(' ')}`;
}

function renderInline(node: InlineNode): string {
  if (node.type === 'text') {
    return wrapMarks(esc(node.text), node.marks);
  }
  if (node.type === 'link') {
    return wrapMarks(
      `<a href="${esc(node.href)}" rel="noopener noreferrer" target="_blank">${esc(node.text)}</a>`,
      node.marks,
    );
  }
  // span
  return wrapMarks(
    `<span ${spanAttrs(node)}>${esc(node.text)}</span>`,
    node.marks,
  );
}

function renderChildren(children: InlineNode[]): string {
  return children.map(renderInline).join('');
}

function renderBlock(block: Block): string {
  if (block.type === 'list') {
    const tag = block.ordered ? 'ol' : 'ul';
    const items = block.items
      .map((item) => `<li>${renderChildren(item.children)}</li>`)
      .join('');
    return `<${tag}>${items}</${tag}>`;
  }
  const inner = renderChildren(block.children);
  if (block.level) {
    return `<h${block.level}>${inner}</h${block.level}>`;
  }
  return `<p>${inner}</p>`;
}

// Renders `Doc.children` to an HTML string. Caller wraps it in a
// `.analysis` container so the span styles in app.css apply.
export function renderDoc(doc: Doc): string {
  return doc.children.map(renderBlock).join('\n');
}
