// Server-side node-tree -> HTML for the reader page (PLAN.md §6). Every
// word/phrase span carries its id (`data-word-definition-id` /
// `data-phrase-id`) so it opens the popup; one whose effective state for the
// viewer is `learned` or `skipped` also carries `data-known` and stays
// unhighlighted. Grammar-only spans render like a text node. Grammar usage
// points are placed separately (`applyGrammarMatches`) and wrap their nodes in
// a `data-grammar-usage-point-id` span, flagged the same way. Output is injected with `set:html`, so
// every text value is escaped here. Content tokens of the spaCy layer are
// wrapped in `data-tok` spans as the text renders (lib/render-tokens.ts).

import { applyGrammarMatches } from './apply-grammar-matches';
import {
  groupTokens,
  renderTokenText,
  type UnitTokens,
  unitKey,
  unitTokens,
} from './render-tokens';
import type {
  Block,
  Doc,
  EffectiveState,
  InlineNode,
  Mark,
  PostDetail,
  ReaderToken,
  SpanNode,
} from './types';

type Annotations = PostDetail['annotations'];

interface RenderContext {
  annotations: Annotations;
  // Grammar usage points the viewer no longer needs highlighted.
  settledGrammar: Set<string>;
}

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

function isMarked(state: EffectiveState): boolean {
  return state === 'new' || state === 'learning';
}

const KNOWN_ATTR = ' data-known';

function spanAttr(node: SpanNode, annotations: Annotations): string | null {
  if (node.kind === 'word') {
    const state = annotations.words[node.wordDefinitionId]?.state;
    return state
      ? `data-word-definition-id="${esc(node.wordDefinitionId)}"${isMarked(state) ? '' : KNOWN_ATTR}`
      : null;
  }
  if (node.kind === 'phrase') {
    const state = annotations.phrases[node.phraseId]?.state;
    return state
      ? `data-phrase-id="${esc(node.phraseId)}"${isMarked(state) ? '' : KNOWN_ATTR}`
      : null;
  }
  return null;
}

function renderNode(
  node: InlineNode,
  ctx: RenderContext,
  unit: UnitTokens,
): string {
  const text = renderTokenText(node.text, unit, esc);
  if (node.type === 'link') {
    return `<a href="${esc(node.href)}" rel="noopener noreferrer" target="_blank">${text}</a>`;
  }
  if (node.type === 'span') {
    const attr = spanAttr(node, ctx.annotations);
    if (attr) {
      return `<span ${attr}>${text}</span>`;
    }
  }
  return text;
}

function renderInline(
  node: InlineNode,
  ctx: RenderContext,
  unit: UnitTokens,
): string {
  return wrapMarks(renderNode(node, ctx, unit), node.marks);
}

// Consecutive nodes of one grammar usage point share a single wrapper: the
// word/phrase spans inside a match cut it into pieces, and a piece holding only
// the space between two spans would otherwise render as an empty chip.
function renderChildren(
  children: InlineNode[],
  ctx: RenderContext,
  tokens: ReaderToken[] | undefined,
): string {
  const unit = unitTokens(tokens);
  let out = '';
  for (let i = 0; i < children.length; ) {
    const id = children[i].grammarUsagePointId;
    let end = i + 1;
    while (id && children[end]?.grammarUsagePointId === id) {
      end++;
    }
    const html = children
      .slice(i, end)
      .map((child) => renderInline(child, ctx, unit))
      .join('');
    out += id
      ? `<span data-grammar-usage-point-id="${esc(id)}"${ctx.settledGrammar.has(id) ? KNOWN_ATTR : ''}>${html}</span>`
      : html;
    i = end;
  }
  return out;
}

// `data-block` / `data-item` carry the block's index in Doc.children and a
// list item's index — the coordinates the reader's token analysis is placed by.
function renderBlock(
  block: Block,
  index: number,
  ctx: RenderContext,
  tokens: Map<string, ReaderToken[]>,
): string {
  if (block.type === 'list') {
    const tag = block.ordered ? 'ol' : 'ul';
    const items = block.items
      .map(
        (item, itemIndex) =>
          `<li data-item="${itemIndex}">${renderChildren(item.children, ctx, tokens.get(unitKey(index, itemIndex)))}</li>`,
      )
      .join('');
    return `<${tag} data-block="${index}">${items}</${tag}>`;
  }
  const inner = renderChildren(
    block.children,
    ctx,
    tokens.get(unitKey(index, null)),
  );
  if (block.level) {
    return `<h${block.level} data-block="${index}">${inner}</h${block.level}>`;
  }
  if (block.quote) {
    return `<blockquote data-block="${index}">${inner}</blockquote>`;
  }
  return `<p data-block="${index}">${inner}</p>`;
}

// Renders `Doc.children` to an HTML string. Caller wraps it in a
// `.analysis` container so the span styles in app.css apply.
export function renderDoc(doc: Doc, annotations: Annotations): string {
  // `?? []`: an API still on the previous release omits `tokens` /
  // `grammarMatches`.
  const tokens = groupTokens(annotations.tokens ?? []);
  const matches = annotations.grammarMatches ?? [];
  const ctx: RenderContext = {
    annotations,
    settledGrammar: new Set(
      matches
        .filter((match) => !isMarked(match.state))
        .map((match) => match.grammarUsagePointId),
    ),
  };
  return applyGrammarMatches(doc, matches)
    .children.map((block, index) => renderBlock(block, index, ctx, tokens))
    .join('\n');
}
