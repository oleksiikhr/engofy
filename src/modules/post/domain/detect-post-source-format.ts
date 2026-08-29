import { PostSourceFormat } from '../enums/post-source-format.enum.js';

// Known tags handled by html-to-doc.converter.ts, plus a few common inline/
// structural ones — matched as real tag opens/closes to avoid false
// positives on stray "<"/">" in plain text (e.g. "if x < 5").
const HTML_TAG_RE =
  /<\/?(?:p|h[1-6]|ul|ol|li|a|strong|b|em|i|div|span|br|html|body)\b/i;

const MARKDOWN_HEADING_RE = /^#{1,6}\s/m;
const MARKDOWN_BULLET_LIST_RE = /^[-*+]\s/m;
const MARKDOWN_ORDERED_LIST_RE = /^\d+\.\s/m;
const MARKDOWN_BOLD_RE = /\*\*[^*]+\*\*|__[^_]+__/;
const MARKDOWN_LINK_RE = /\[[^\]]+\]\([^)]+\)/;

function looksLikeHtml(rawText: string): boolean {
  return HTML_TAG_RE.test(rawText);
}

function looksLikeMarkdown(rawText: string): boolean {
  return (
    MARKDOWN_HEADING_RE.test(rawText) ||
    MARKDOWN_BULLET_LIST_RE.test(rawText) ||
    MARKDOWN_ORDERED_LIST_RE.test(rawText) ||
    MARKDOWN_BOLD_RE.test(rawText) ||
    MARKDOWN_LINK_RE.test(rawText)
  );
}

// Best-effort heuristic — not a parser. Checked in order (html, then
// markdown), falling back to plain text.
export function detectPostSourceFormat(rawText: string): PostSourceFormat {
  if (looksLikeHtml(rawText)) {
    return PostSourceFormat.Html;
  }
  if (looksLikeMarkdown(rawText)) {
    return PostSourceFormat.Markdown;
  }
  return PostSourceFormat.Text;
}
