// Server-side node-tree -> HTML for the reader page (PLAN.md §6). Only a
// word/phrase span whose effective state for the viewer is `new` or
// `learning` is marked (`data-word-definition-id` / `data-phrase-id`); every
// other span — known/skipped targets, grammar-only spans — renders exactly
// like a text node. Grammar usage points are placed separately
// (`applyGrammarMatches`) and wrap their nodes in a
// `data-grammar-usage-point-id` span. Output is injected with `set:html`, so
// every text value is escaped here.

import { applyGrammarMatches } from './apply-grammar-matches';
import type {
  Block,
  Doc,
  EffectiveState,
  InlineNode,
  Mark,
  PostDetail,
  SpanNode,
} from './types';

type Annotations = PostDetail['annotations'];

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

function isMarked(state: EffectiveState | undefined): boolean {
  return state === 'new' || state === 'learning';
}

function spanAttr(node: SpanNode, annotations: Annotations): string | null {
  if (node.kind === 'word') {
    return isMarked(annotations.words[node.wordDefinitionId]?.state)
      ? `data-word-definition-id="${esc(node.wordDefinitionId)}"`
      : null;
  }
  if (node.kind === 'phrase') {
    return isMarked(annotations.phrases[node.phraseId]?.state)
      ? `data-phrase-id="${esc(node.phraseId)}"`
      : null;
  }
  return null;
}

function renderNode(node: InlineNode, annotations: Annotations): string {
  if (node.type === 'link') {
    return `<a href="${esc(node.href)}" rel="noopener noreferrer" target="_blank">${esc(node.text)}</a>`;
  }
  if (node.type === 'span') {
    const attr = spanAttr(node, annotations);
    if (attr) {
      return `<span ${attr}>${esc(node.text)}</span>`;
    }
  }
  return esc(node.text);
}

function renderInline(node: InlineNode, annotations: Annotations): string {
  const html = renderNode(node, annotations);
  return wrapMarks(
    node.grammarUsagePointId
      ? `<span data-grammar-usage-point-id="${esc(node.grammarUsagePointId)}">${html}</span>`
      : html,
    node.marks,
  );
}

function renderChildren(
  children: InlineNode[],
  annotations: Annotations,
): string {
  return children.map((child) => renderInline(child, annotations)).join('');
}

function renderBlock(block: Block, annotations: Annotations): string {
  if (block.type === 'list') {
    const tag = block.ordered ? 'ol' : 'ul';
    const items = block.items
      .map((item) => `<li>${renderChildren(item.children, annotations)}</li>`)
      .join('');
    return `<${tag}>${items}</${tag}>`;
  }
  const inner = renderChildren(block.children, annotations);
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
export function renderDoc(doc: Doc, annotations: Annotations): string {
  // `?? []`: an API still on the previous release omits `grammarMatches`.
  return applyGrammarMatches(doc, annotations.grammarMatches ?? [])
    .children.map((block) => renderBlock(block, annotations))
    .join('\n');
}
