// Server-side node-tree -> HTML for the reader page (PLAN.md §6). Word/
// phrase/grammar spans carry no visible markup any more (PLAN.md §16 —
// inline highlighting removed in favour of the "In this article" sidebar,
// built separately from `PostDetail.sidebar` + `.annotations`); a span node
// renders exactly like a text node. Output is injected with `set:html`, so
// every text value is escaped here.

import type { Block, Doc, InlineNode, Mark } from './types';

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

function renderInline(node: InlineNode): string {
  if (node.type === 'link') {
    return wrapMarks(
      `<a href="${esc(node.href)}" rel="noopener noreferrer" target="_blank">${esc(node.text)}</a>`,
      node.marks,
    );
  }
  // 'text' and 'span' render identically — a span is plain prose now, its
  // wordDefinitionId/phraseId/grammarConstruct only matter to the sidebar.
  return wrapMarks(esc(node.text), node.marks);
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
  if (block.quote) {
    return `<blockquote>${inner}</blockquote>`;
  }
  return `<p>${inner}</p>`;
}

// Renders `Doc.children` to an HTML string. Caller wraps it in a
// `.analysis` container so the span styles in app.css apply.
export function renderDoc(doc: Doc): string {
  return doc.children.map(renderBlock).join('\n');
}
