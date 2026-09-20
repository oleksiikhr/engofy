import type { Doc, Node } from './node-tree.types.js';

function inlineText(children: Node[]): string {
  return children.map((node) => node.text).join('');
}

// A markdown/html post ingested without an explicit title takes its opening
// level-1 heading as the title, so it neither shows as "Untitled" nor repeats
// that heading in the body (stripRedundantTitleHeading then drops it). Returns
// null when the doc doesn't open with a non-empty H1.
export function deriveTitleFromHeading(doc: Doc): string | null {
  const [first] = doc.children;
  if (first?.type !== 'paragraph' || first.level !== 1) {
    return null;
  }
  const text = inlineText(first.children).trim().replace(/\s+/g, ' ');
  return text === '' ? null : text;
}
