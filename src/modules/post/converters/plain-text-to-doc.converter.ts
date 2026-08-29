import type { Doc } from '../domain/node-tree.types.js';

const BLANK_LINE = /\n\s*\n/;

export function convertPlainTextToDoc(rawText: string): Doc {
  const paragraphs = rawText
    .split(BLANK_LINE)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  return {
    type: 'doc',
    children: paragraphs.map((text) => ({
      type: 'paragraph',
      children: [{ type: 'text', text }],
    })),
  };
}
